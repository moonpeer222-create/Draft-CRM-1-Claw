const fs = require('fs');

const conflictState = fs.readFileSync('conflict_state.txt', 'utf8').replace(/showCaseDetail/g, 'isOpen');
const mStates = fs.readFileSync('modal_sub_states.txt', 'utf8');
const dlEffect = fs.readFileSync('deep_link_effect.txt', 'utf8').replace(/setShowCaseDetail\(true\)/g, 'setSelectedCase(target); setDeepLinked(true)');
const tEffect = fs.readFileSync('tick_effect.txt', 'utf8');
const handlers = fs.readFileSync('detail_handlers.txt', 'utf8');
const deleteHandler = fs.readFileSync('delete_handler.txt', 'utf8').replace(/setShowCaseDetail\(false\)/g, 'onClose()');
const colors = fs.readFileSync('detail_colors.txt', 'utf8');
const detailJsx = fs.readFileSync('detail_jsx.txt', 'utf8')
  .replace(/showCaseDetail && selectedCase && \(/g, '(')
  .replace(/setShowCaseDetail\(false\)/g, 'onClose()')
  .replace(/<motion\.div\s+variants=\{modalVariants\}.*?>/s, '') // Remove outer modal div since skeleton has it
  .replace(/<\/motion\.div>\s+<\/motion\.div>\s+<\/AnimatePresence>/m, ''); // Remove outer modal closure

const delayJsx = fs.readFileSync('delay_modal_jsx.txt', 'utf8')
  .replace(/showDelayModal && selectedCase && \(/g, '(')
  .replace(/setShowDelayModal\(false\)/g, 'setShowDelayModal(false)')
  .replace(/<motion\.div\s+initial=\{.*?\}.*?onClick=\{.*?setShowDelayModal\(false\)\}.*?>/s, '');

let target = fs.readFileSync('src/app/components/CaseDetailModal.tsx', 'utf8');

target = target.replace('// [HOOKS_PLACEHOLDER]', conflictState + '\n' + mStates + '\n' + dlEffect + '\n' + tEffect);
target = target.replace('// [HANDLERS_PLACEHOLDER]', handlers + '\n' + deleteHandler);
target = target.replace('// [HELPERS_PLACEHOLDER]', colors);
target = target.replace('{/* [JSX_PLACEHOLDER] */}', detailJsx);
target = target.replace('{/* [DELAY_JSX_PLACEHOLDER] */}', delayJsx);

fs.writeFileSync('src/app/components/CaseDetailModal.tsx', target);
console.log('CaseDetailModal.tsx injected successfully');
