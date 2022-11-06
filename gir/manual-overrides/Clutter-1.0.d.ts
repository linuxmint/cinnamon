declare namespace imports.gi.Clutter {

  /** Write only */
  interface IActor {
    /**
     * 
     * 
 * According to the GJS docs (https://gjs-docs.gnome.org), the Clutter 
 * Actor properties 'x_align' and 'y_align' have the type Clutter.ActorAlign. 
 * However according to the gnome docs (https://developer.gnome.org/st/stable/StBin.html) 
 * and own observations, the St.Bin properties 'x_align' and 'y_align' are 
 * actually of the type St.Align. This means in order to allow St.Bin as well 
 * as  other St classes to implement Clutter.Actor the Clutter.Actor 
 * x_align and y_align props have to be either of type Clutter.
 * ActorAlign or St.Align and each class inheriting from Clutter.Actor 
 * must be speficy the type by it's own. 
* 
*/
    x_align: ActorAlign | St.Align;
    /** See {@link x_align} */
    y_align: ActorAlign | St.Align;
  }

  interface ButtonEvent extends Event {

  }

  interface CrossingEvent extends Event {
    
  }

  interface KeyEvent extends Event {
    
  }

  interface MotionEvent extends Event {
    
  }

  interface ScrollEvent extends Event {
    
  }

  interface AnyEvent extends Event {
    
  }

  interface StageStateEvent extends Event {

  }

  interface TouchpadPinchEvent extends Event {

  }

  interface TouchpadSwipeEvent extends Event {

  }

  interface TouchEvent extends Event {

  }

  export enum DebugFlag {

  }

  export enum PickDebugFlag {

  }

  export enum DrawDebugFlag {

  }
}