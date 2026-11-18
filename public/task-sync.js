'use strict';

// NEXURA Tasks: offline-first synchronization.
(() => {
  const QUEUE_KEY = 'nexura_tasks_pending_sync_v1';
  let syncing = false;

  function readQueue() {
    try {
      const value = JSON.parse(
        localStorage.getItem(QUEUE_KEY) || '{}'
      );
      return value && typeof value === 'object' &&
        !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function queueTask(task) {
    if (!task || !task.id) return false;

    const queue = readQueue();
    queue[task.id] = {
      id: task.id,
      title: task.title || 'Untitled Task',
      description: task.note || '',
      status: task.status || 'Planned',
      due_date: task.due || null,
      task_data: { ...task }
    };

    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('NEXURA: Cannot save sync queue', error);
      return false;
    }

    if (navigator.onLine) syncTasks();
    return true;
  }

  async function syncTasks() {
    if (syncing || !navigator.onLine) return;
    syncing = true;

    try {
      const queue = readQueue();

      for (const [id, task] of Object.entries(queue)) {
        const checkResponse = await fetch('/api/tasks', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
        });

        if (!checkResponse.ok) {
        console.warn('NEXURA: Could not check existing tasks');
        break;
        }

        const checkData = await checkResponse.json();

        if (!checkData.ok || !Array.isArray(checkData.tasks)) {
        console.warn('NEXURA: Invalid tasks response');
        break;
        }

        const alreadyExists = checkData.tasks.some(
        existing => existing.id === id
        );

        const response = await fetch('/api/tasks', {
        method: alreadyExists ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
        });

        if (!response.ok) {
          console.warn('NEXURA: Sync pending', response.status);
          break;
        }

        // Remove only the version successfully uploaded.
        const latest = readQueue();

        if (JSON.stringify(latest[id]) === JSON.stringify(task)) {
          delete latest[id];
          localStorage.setItem(
            QUEUE_KEY,
            JSON.stringify(latest)
          );
        }
      }
    } catch (error) {
      console.warn('NEXURA: Will retry sync', error);
    } finally {
      syncing = false;
    }
  }

  window.NexuraTasksSync = {
    queueTask,
    syncTasks
  };

  window.addEventListener('online', syncTasks);
  window.addEventListener('focus', syncTasks);
})();