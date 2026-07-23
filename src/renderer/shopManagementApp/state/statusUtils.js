import { reactive } from 'vue';
import { normalizeText } from '../helpers';

export function createStatusState() {
  return reactive({
    type: 'info',
    message: ''
  });
}

export function setStatus(target, message, type = 'info') {
  target.message = normalizeText(message);
  target.type = type;
}
