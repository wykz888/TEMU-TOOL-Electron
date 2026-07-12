const APP_UPDATE_FEED_URL =
  process.env.TEMU_TOOLBOX_UPDATE_FEED_URL
  || 'https://item-1251234463.cos.ap-guangzhou.myqcloud.com/TEMU_Data_Electron/App_Update/win/';

const APP_UPDATE_RELEASE_HISTORY_URL = new URL('release-history.json', APP_UPDATE_FEED_URL).toString();

module.exports = {
  APP_UPDATE_FEED_URL,
  APP_UPDATE_RELEASE_HISTORY_URL
};
