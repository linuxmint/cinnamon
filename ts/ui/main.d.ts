
/**
 * @short_description This is the heart of Cinnamon, the mother of everything.
 * 
 * The main file is responsible for launching Cinnamon as well as creating its
 * components. The C part of cinnamon calls the start() function, which then
 * initializes all of cinnamon. Most components of Cinnamon can be accessed
 * through main.
 */
 declare namespace imports.ui.main {

    /**
     * notifyError:
     * @msg (string): An error message
     * @details (string): Additional information
     *
     * See cinnamon_global_notify_problem().
     */
    export function notifyError(msg: string, details: string): void;
}