const { jimengTextToImageModule } = require('./textToImage');
const { jimengImageToImageModule } = require('./imageToImage');

const jimengImageFeature = Object.freeze({
  kind: 'feature',
  id: 'jimeng-image',
  tag: '\u5373\u68A6',
  title: '\u5373\u68A6\u751F\u56FE',
  description: '\u6279\u91cf\u6253\u5F00\u5373\u68A6\u751F\u56FE\u5DE5\u4F5C\u53F0\uFF0C\u652F\u6301\u63D0\u793A\u8BCD\u961F\u5217\u3001\u53C2\u8003\u56FE\u4E0A\u4F20\u3001\u751F\u6210\u8FDB\u5EA6\u8DDF\u8E2A\u548C\u7ED3\u679C\u56FE\u7247\u4FDD\u5B58\u3002',
  storageKey: 'creation_center/jimeng_image',
  codeCategory: 'creation_center.jimeng_image',
  codeDirectory: 'src/features/creationCenter/jimengImage/index.js',
  windowAction: 'open-jimeng-image',
  actionLabel: '\u6253\u5F00\u5373\u68A6',
  modules: [
    jimengTextToImageModule,
    jimengImageToImageModule
  ]
});

module.exports = {
  jimengImageFeature
};
