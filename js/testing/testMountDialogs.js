// Test helpers for mount operation dialogs.
// Call from Looking Glass:
//
//   imports.testing.testMountDialogs.askPassword()
//   imports.testing.testMountDialogs.askPassword("Unlock encrypted volume\nEnter password for 'My Drive'")
//   imports.testing.testMountDialogs.askPasswordTcrypt()
//   imports.testing.testMountDialogs.askQuestion()
//   imports.testing.testMountDialogs.askQuestion("Trust this certificate?\nThe identity of 'server.local' cannot be verified.", ["Cancel", "Trust", "Trust Always"])
//   imports.testing.testMountDialogs.showProcesses()

const Gio = imports.gi.Gio;
const MountOp = imports.ui.cinnamonMountOperation;

function askPassword(message, flags) {
    message = message || "Enter a password to unlock the volume\nThe password is needed to access encrypted data on My Encrypted Drive.";
    flags = flags || Gio.AskPasswordFlags.NEED_PASSWORD;

    let dialog = new MountOp.CinnamonMountPasswordDialog(message, flags);
    dialog.connect('response', (obj, choice, password, remember, hidden, system, pim) => {
        log(`[testMountDialogs] askPassword response: choice=${choice} password=${password}`);
        dialog.close();
    });
    dialog.open();
    return dialog;
}

function askPasswordTcrypt(message) {
    message = message || "Enter a password to unlock the volume\nThe password is needed to access encrypted data on My VeraCrypt Drive.";
    let flags = Gio.AskPasswordFlags.NEED_PASSWORD | Gio.AskPasswordFlags.TCRYPT;

    return askPassword(message, flags);
}

function askQuestion(message, choices) {
    message = message || "Mount point is not empty\nThe mount point /mnt/data already contains files. Do you want to merge?";
    choices = choices || ["Cancel", "Merge"];

    let dialog = new MountOp.CinnamonMountQuestionDialog();
    dialog.connect('response', (obj, choice) => {
        log(`[testMountDialogs] askQuestion response: choice=${choice}`);
        dialog.close();
    });
    dialog.update(message, choices);
    dialog.open();
    return dialog;
}

function showProcesses(message, choices) {
    message = message || "Volume is busy\nOne or more applications are keeping the volume busy.";
    choices = choices || ["Cancel", "Unmount Anyway"];

    let dialog = new MountOp.CinnamonProcessesDialog();
    dialog.connect('response', (obj, choice) => {
        log(`[testMountDialogs] showProcesses response: choice=${choice}`);
        dialog.close();
    });

    // Use real PIDs of running apps if possible, otherwise empty
    let pids = [];
    dialog.update(message, pids, choices);
    dialog.open();
    return dialog;
}
