# Issues Found During Integration Testing

Quick reference for Tech Lead review.

## 🔴 Critical Issues

### Issue #1: Task 9 Incomplete - FileWatcher Not Integrated

**Status:** Marked "done" but code missing
**File:** `inc-mac/Sources/Inc/ViewModels/DocumentViewModel.swift`
**Impact:** Documents don't auto-reload when agents edit them (Test #3 will fail)

**What's missing:**
```swift
// Missing from DocumentViewModel class:
private var fileWatcher: FileWatcher?
@Published var isReloading: Bool = false

// Missing from loadSpec() and loadArchitecture():
fileWatcher?.stop()
fileWatcher = FileWatcher(paths: [documentPath], debounceInterval: 0.3) { [weak self] in
    self?.reloadCurrentDocument()
}
fileWatcher?.start()
```

**Fix effort:** 30 minutes
**Assigned to:** Task 9 coder (coder-1769627704503)

---

### Issue #2: Task 10 Incomplete - No Visual Update Indicator

**Status:** Marked "done" but code missing
**File:** `inc-mac/Sources/Inc/Views/DocumentView.swift`
**Impact:** No user feedback when document reloads

**What's missing:**
```swift
// Missing overlay in DocumentView:
if viewModel.isReloading {
    ZStack {
        Color.black.opacity(0.3)
        HStack {
            ProgressView()
            Text("Updating...")
        }
    }
    .transition(.opacity)
    .animation(.easeInOut(duration: 0.2))
}
```

**Fix effort:** 20 minutes
**Assigned to:** Task 10 coder (coder-1769627850421)

---

## 🟡 Minor Issues

### Issue #3: Chat History Never Pruned

**File:** `src/daemon/index.ts` (line 656)
**Impact:** chat.jsonl grows unbounded over time

**Fix:**
```typescript
// After line 656, add:
await appendChatMessage(projectRoot, request.epicId, agentMessage);
await pruneOldMessages(projectRoot, request.epicId, 100); // ← Add this
```

**Fix effort:** 5 minutes

---

### Issue #4: Inconsistent Message Limits

**Files:**
- `inc-mac/Sources/Inc/ViewModels/ChatViewModel.swift` line 71: `maxMessageHistory = 20`
- `src/state/chat.ts` line 89: `maxMessages: number = 100`

**Impact:** Confusion about history retention
**Fix:** Standardize on 100 or make configurable
**Fix effort:** 5 minutes

---

### Issue #5: No Scroll Position Preservation

**File:** `inc-mac/Sources/Inc/Views/DocumentView.swift`
**Impact:** When document reloads, user loses scroll position

**Enhancement:** Save/restore scroll offset during reload
**Fix effort:** 15 minutes
**Priority:** Low (nice-to-have)

---

## ✅ What Works Correctly

1. **Epic chat request/response flow** ✅
2. **Sequential PM → Tech Lead spawning** ✅
3. **Role metadata propagation** ✅
4. **Chat history persistence** ✅
5. **Message bubbles with role badges** ✅
6. **Empty epic handling (no chat.jsonl)** ✅
7. **Epic with no architecture.md** ✅
8. **Backend agent routing** ✅

---

## Test Status Summary

| Test | Status | Blocker |
|------|--------|---------|
| Basic chat flow | 🟢 READY | None |
| Multi-agent response | 🟢 READY | None |
| Document auto-reload | 🔴 BLOCKED | Issues #1, #2 |
| Chat history persistence | 🟢 READY | None |
| No architecture.md edge case | 🟢 READY | None |
| No chat history edge case | 🟢 READY | None |
| >100 messages pruning | 🟡 PARTIAL | Issue #3 |

---

## Recommended Actions

### Option A: Fix Before Completing Epic (Recommended)
1. Reassign Task 9 to implement FileWatcher integration (30 min)
2. Reassign Task 10 to add visual indicator (20 min)
3. Apply Issue #3 fix (5 min)
4. Manual testing with Mac app (30 min)
5. Mark epic complete

**Total time:** ~90 minutes

### Option B: Document and Defer
1. Update spec to list document auto-reload as "deferred to v2"
2. Add warning in README: "Documents must be manually refreshed"
3. Create follow-up epic for auto-reload feature
4. Complete current epic with limitation documented

**Total time:** ~15 minutes

---

## How to Verify Fixes

### After fixing Issues #1 and #2:

```swift
// Test manually in Mac app:
1. Open spec.md in DocumentView
2. In chat, say: "Add requirement R5 to the spec"
3. Wait for PM to respond
4. Observe:
   - "Updating..." spinner appears briefly
   - Document content updates automatically
   - Scroll position preserved (if possible)
   - Update completes within 1 second
```

### After fixing Issue #3:

```bash
# Create epic with long conversation
inc new "test pruning"
# ... have >100 message conversation ...

# Check file size
wc -l ~/.inc/projects/<hash>/epics/<id>/chat.jsonl
# Should show ~100 lines, not >100
```

---

## Files to Review

1. **GROUP_CHAT_INTEGRATION_TEST_REPORT.md** - Full test analysis (500 lines)
2. **TASK_11_COMPLETION_SUMMARY.md** - Task completion summary
3. **inc-mac/README.md** - User documentation (added section)
4. **README.md** - Main README (added Mac app section)

---

**Created by:** Coder agent (Task #11)
**Date:** 2025-01-28
**Epic:** Group Chat Experience (fff43e3e)
