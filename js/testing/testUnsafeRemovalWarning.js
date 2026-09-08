// Test helper for the unsafe removal warning.
// Call from Looking Glass:
//
//   imports.testing.testUnsafeRemovalWarning.show()
//   imports.testing.testUnsafeRemovalWarning.show("My USB Stick")
//   imports.testing.testUnsafeRemovalWarning.show(null)  // unnamed device

const AutomountManager = imports.ui.automountManager;

function show(driveName = "JetFlash Transcend 4GB") {
    AutomountManager.notifyUnsafeRemoval(driveName);
}
