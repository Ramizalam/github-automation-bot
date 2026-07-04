import { actionRegistry } from "@/lib/actions/registry";
import { AddLabelStrategy } from "@/lib/actions/add-label.action";
import { SendSlackStrategy } from "@/lib/actions/send-slack.action";
import { CloseIssueStrategy } from "@/lib/actions/close-issue.action";

// =============================================================================
// Action Registry Bootstrap
// =============================================================================
//
// This is the ONLY file you need to edit when adding a new action type.
//
// HOW TO ADD A NEW ACTION TYPE:
//   1. Create `src/lib/actions/my-new.action.ts`
//   2. Implement IActionStrategy (add `actionType` + `execute`)
//   3. Import and register it below with one line:
//        actionRegistry.register(new MyNewStrategy());
//   ✅ Done — zero changes to ActionService, EventService, or any other file.
//
// This file is imported by ActionService, which triggers this module to
// evaluate exactly once, populating the registry before any events are processed.
// =============================================================================

actionRegistry.register(new AddLabelStrategy());
actionRegistry.register(new SendSlackStrategy());
actionRegistry.register(new CloseIssueStrategy());
