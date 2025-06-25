# Phase Completion Checklist

## CRITICAL: Follow this checklist IN ORDER for EVERY phase completion

### ✅ Phase Implementation
- [ ] Complete all deliverables for the phase
- [ ] Ensure all code compiles without errors
- [ ] Run `npm run build` to verify

### 🔍 Expert Review (DO THIS BEFORE COMMITTING!)
- [ ] Use `mcp__zen__codereview` to get review from o3 model
- [ ] Use `mcp__zen__consensus` to get multiple perspectives if needed
- [ ] Document all feedback received
- [ ] Implement critical fixes identified
- [ ] Address security concerns
- [ ] Fix any architectural issues

### 📝 Git Commit & Tag (ONLY AFTER REVIEW!)
- [ ] Stage all changes with `git add`
- [ ] Create descriptive commit message following format:
  ```
  <type>: Complete Phase X - <Phase Title> [phase-X]
  
  <Detailed description of what was implemented>
  
  <List of review feedback addressed>
  
  🤖 Generated with [Claude Code](https://claude.ai/code)
  
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- [ ] Create tag: `git tag -a phase-X-complete -m "Phase X: <description>"`

### 📋 Documentation
- [ ] Update any relevant documentation
- [ ] Document learnings or changes from review feedback

### ➡️ Next Phase
- [ ] Only proceed after all above steps are complete
- [ ] Create new todo list for next phase

## Phase Status Tracking

- Phase 0: ✅ Complete (review was done retroactively)
- Phase 0.5: ⚠️ Committed before review (MISTAKE - need to get review now)
- Phase 1: 🔜 Pending
- Phase 2: 🔜 Pending
- Phase 3: 🔜 Pending
- Phase 4: 🔜 Pending
- Phase 5: 🔜 Pending
- Phase 6: 🔜 Pending