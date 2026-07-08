const JIMENG_IMAGE_CHANNELS = Object.freeze({
  UPDATE_WORKSPACE: 'jimeng-image:update-workspace',
  REQUEST_WORKSPACE_SYNC: 'jimeng-image:request-workspace-sync',
  RELOAD_BROWSER: 'jimeng-image:reload-browser',
  NAVIGATE_HOME: 'jimeng-image:navigate-home',
  OPEN_CURRENT_URL_EXTERNAL: 'jimeng-image:open-current-url-external',
  BROWSER_STATE_CHANGED: 'jimeng-image:browser-state-changed',
  GET_SETTINGS: 'jimeng-image:get-settings',
  SAVE_SETTINGS: 'jimeng-image:save-settings',
  SELECT_SAVE_DIRECTORY: 'jimeng-image:select-save-directory',
  GET_BATCH_STATE: 'jimeng-image:get-batch-state',
  START_BATCH_GENERATION: 'jimeng-image:start-batch-generation',
  PAUSE_BATCH_GENERATION: 'jimeng-image:pause-batch-generation',
  RESUME_BATCH_GENERATION: 'jimeng-image:resume-batch-generation',
  STOP_BATCH_GENERATION: 'jimeng-image:stop-batch-generation',
  TASK_EVENT: 'jimeng-image:task-event'
});

module.exports = {
  JIMENG_IMAGE_CHANNELS
};
