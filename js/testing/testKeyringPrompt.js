// Test helpers for keyring prompt dialog.
// Call from Looking Glass:
//
//   imports.ui.testKeyringPrompt.passwordPrompt()
//   imports.ui.testKeyringPrompt.passwordPrompt("Save this password in your keyring")
//   imports.ui.testKeyringPrompt.passwordPromptNoChoice()
//   imports.ui.testKeyringPrompt.confirmPrompt()
//   imports.ui.testKeyringPrompt.newPasswordPrompt()

const Gcr = imports.gi.Gcr;
const KeyringPrompt = imports.ui.keyringPrompt;

function passwordPrompt(choiceLabel) {
    let dialog = new KeyringPrompt.KeyringDialog();
    let prompt = dialog.prompt;

    prompt.set_message("Unlock Keyring");
    prompt.set_description("Enter password for keyring 'login' to unlock");
    prompt.set_choice_label(choiceLabel || "Always unlock this keyring whenever logged in");
    prompt.set_continue_label("Unlock");
    prompt.set_cancel_label("Cancel");

    prompt.password_async(null, (source, result) => {
        try {
            let password = prompt.password_finish(result);
            log(`[testKeyringPrompt] password: ${password}, choice_chosen: ${prompt.choice_chosen}`);
        } catch(e) {
            log(`[testKeyringPrompt] cancelled: ${e.message}`);
        }
    });

    return dialog;
}

function passwordPromptNoChoice() {
    let dialog = new KeyringPrompt.KeyringDialog();
    let prompt = dialog.prompt;

    prompt.set_message("Unlock Keyring");
    prompt.set_description("Enter password for keyring 'login' to unlock");
    prompt.set_choice_label("");
    prompt.set_continue_label("Unlock");
    prompt.set_cancel_label("Cancel");

    prompt.password_async(null, (source, result) => {
        try {
            let password = prompt.password_finish(result);
            log(`[testKeyringPrompt] password: ${password}`);
        } catch(e) {
            log(`[testKeyringPrompt] cancelled: ${e.message}`);
        }
    });

    return dialog;
}

function confirmPrompt(choiceLabel) {
    let dialog = new KeyringPrompt.KeyringDialog();
    let prompt = dialog.prompt;

    prompt.set_message("Trust This Key");
    prompt.set_description("Do you want to mark this key as trusted?");
    prompt.set_choice_label(choiceLabel || "Always trust this key");
    prompt.set_continue_label("Trust");
    prompt.set_cancel_label("Cancel");

    prompt.confirm_async(null, (source, result) => {
        try {
            let reply = prompt.confirm_finish(result);
            log(`[testKeyringPrompt] confirm reply: ${reply}, choice_chosen: ${prompt.choice_chosen}`);
        } catch(e) {
            log(`[testKeyringPrompt] cancelled: ${e.message}`);
        }
    });

    return dialog;
}

function newPasswordPrompt(choiceLabel) {
    let dialog = new KeyringPrompt.KeyringDialog();
    let prompt = dialog.prompt;

    prompt.set_message("Change Keyring Password");
    prompt.set_description("Enter a new password for the 'login' keyring");
    prompt.set_password_new(true);
    prompt.set_choice_label(choiceLabel || "Always unlock this keyring whenever logged in");
    prompt.set_continue_label("Continue");
    prompt.set_cancel_label("Cancel");

    prompt.password_async(null, (source, result) => {
        try {
            let password = prompt.password_finish(result);
            log(`[testKeyringPrompt] new password: ${password}, choice_chosen: ${prompt.choice_chosen}`);
        } catch(e) {
            log(`[testKeyringPrompt] cancelled: ${e.message}`);
        }
    });

    return dialog;
}
