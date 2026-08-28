// Content engine barrel — validation, conversion, the switch-template engine,
// and reading an activity's ordered rounds regardless of content shape.
export { MODELS, getModel, listModelNames } from './models.js';
export { canConvert, convert, convertibleTargets } from './convert.js';
export { switchOptions, applySwitch, duplicateSwitch } from './switch.js';
export { sessionItems } from './sessionItems.js';
