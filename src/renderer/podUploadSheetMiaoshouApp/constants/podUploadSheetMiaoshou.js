const DEFAULT_PRODUCT_FIELDS = Object.freeze({
  templateId: 'non-fashion',
  category: '',
  localName: '',
  mainNumber: '',
  delivery: '2',
  origin: '\u4e2d\u56fd',
  isCustom: '\u5426',
  sourceFolder: '',
  sourceLink: '',
  description: '',
  descriptionImageOrders: '',
  title: '',
  englishTitle: '',
  specNameOne: '',
  specValueOne: '',
  specNameTwo: '',
  specValueTwo: '',
  declaredPrice: '',
  price: '',
  stock: '',
  platformSku: '',
  length: '',
  width: '',
  height: '',
  weight: '',
  packingList: '',
  packingCount: '',
  codeType: '',
  codeValue: '',
  codeValueDerivedFromSource: false,
  mainVideo: '',
  manual: ''
});

const templateTypeOptions = Object.freeze([
  { value: 'non-fashion', label: '\u975e\u670d\u9970\u7c7b\u6a21\u677f' },
  { value: 'fashion', label: '\u670d\u9970\u7c7b\u6a21\u677f' }
]);

const deliveryOptions = Object.freeze(['1', '2', '9'].map((value) => ({ value, label: value })));
const customOptions = Object.freeze(['\u662f', '\u5426'].map((value) => ({ value, label: value })));
const TITLE_MAX_LENGTH = 255;

export {
  DEFAULT_PRODUCT_FIELDS,
  TITLE_MAX_LENGTH,
  customOptions,
  deliveryOptions,
  templateTypeOptions
};
