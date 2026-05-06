// Contract every template implements. Subclasses MUST override:
//   - static meta = { name, label, icon, contentModel, modes, defaultContent, defaultRules, ... }
//   - static renderPlayer(rootSel, activity, opts)   // SOLO + async-tracked
//   - static renderEditor(root, activity, onChange)
// Optional but recommended:
//   - static getRoundPayload(activity, ctx)          // strip server-only data for LIVE
//   - static scoreSubmission({ value, item, msTaken, activity })
//   - static migrateContent(content, fromVersion)
export class BaseTemplate {
  static meta = {
    name: 'base',
    label: 'Base',
    icon: 'bi-puzzle',
    color: 'secondary',
    contentModel: null,
    templateVersion: 1,
    // Player frame aspect ratio. Use '4/3', '16/9', '1/1', or 'auto' (no
    // forced ratio, height grows with content). The page chrome wraps the
    // player in a max-width 960 box and applies this. Mobile portrait
    // collapses to 'auto' regardless.
    aspectRatio: '4/3',
    modes: { solo: false, live: false, async: false, practice: false },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({}),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({})
  };
  static renderPlayer() { throw new Error('renderPlayer not implemented'); }
  static renderEditor() { throw new Error('renderEditor not implemented'); }
}
