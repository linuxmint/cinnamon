declare namespace imports.gi.cairo {
    interface Context {
        /**
         * Sets the source pattern within Context to source. This pattern will then be used for any subsequent drawing operation until a new source pattern is set.
         * 
         * Note: The pattern’s transformation matrix will be locked to the user space in effect at the time of setSource(). This means that further modifications of the current transformation matrix will not affect the source pattern. See Pattern.setMatrix()
         * 
         * The default source pattern is a solid pattern that is opaque black, (that is, it is equivalent to setSourceRGB(0.0, 0.0, 0.0)
         * 
         * @param source  a Pattern to be used as the source for subsequent drawing operations.
         */
        setSource(source: Pattern): void


        /**
         * Sets the source pattern within Context to a translucent color. This color will then be used for any subsequent drawing operation until a new source pattern is set.
         * 
         * The color and alpha components are floating point numbers in the range 0 to 1. If the values passed in are outside that range, they will be clamped.
         * 
         * The default source pattern is opaque black, (that is, it is equivalent to setSourceRGBA(0.0, 0.0, 0.0, 1.0)
         * 
         * @param red red component of color
         * @param green green component of color
         * @param blue blue component of color
         * @param alpha  alpha component of color
         */
        setSourceRGBA(red: number, green: number, blue: number, alpha: number): void

        /**
         * Adds a circular arc of the given radius to the current path. The arc is centered at (xc, yc), begins at angle1 and proceeds in the direction of increasing angles to end at angle2. If angle2 is less than angle1 it will be progressively increased by 2*PI until it is greater than angle1.
         * 
         * If there is a current point, an initial line segment will be added to the path to connect the current point to the beginning of the arc. If this initial line is undesired, it can be avoided by calling Context.new_sub_path() before calling Context.arc().
         * 
         * Angles are measured in radians. An angle of 0.0 is in the direction of the positive X axis (in user space). An angle of PI/2.0 radians (90 degrees) is in the direction of the positive Y axis (in user space). Angles increase in the direction from the positive X axis toward the positive Y axis. So with the default transformation matrix, angles increase in a clockwise direction. 
         * 
         * To convert from degrees to radians, use degrees * (math.pi / 180).
         * 
         * This function gives the arc in the direction of increasing angles; see Context.arc_negative() to get the arc in the direction of decreasing angles.
         * 
         * The arc is circular in user space. To achieve an elliptical arc, you can scale the current transformation matrix by different amounts in the X and Y directions. For example, to draw an ellipse in the box given by x, y, width, height:
         * 
         * @param xc  X position of the center of the arc
         * @param yc  Y position of the center of the arc
         * @param radius the radius of the arc
         * @param angle1 the start angle, in radians
         * @param angle2 the end angle, in radians
         */
        arc(xc: number, yc: number, radius: number, angle1: number, angle2: number): void



        /**
         * Adds a closed sub-path rectangle of the given size to the current path at position (x, y) in user-space coordinates.
         * 
         * 
         * @param x  the X coordinate of the top left corner of the rectangle
         * @param y  the Y coordinate to the top left corner of the rectangle
         * @param width the width of the rectangle
         * @param height the height of the rectangle
         */
        rectangle(x: number, y: number, width: number, height: number): void

        /**
         * A drawing operator that fills the current path according to the current fill rule, (each sub-path is implicitly closed before being filled). After fill(), the current path will be cleared from the Context. See Context.set_fill_rule() and Context.fill_preserve().
         * 
         */
        fill(): void

        /**
         * A drawing operator that fills the current path according to the current fill rule, (each sub-path is implicitly closed before being filled). Unlike Context.fill(), fillPreserve() preserves the path within the Context
         */
        fillPreserve(): void

        /**
         * Adds a line to the path from the current point to position (x, y) in user-space coordinates. After this call the current point will be (x, y).
         * 
         * If there is no current point before the call to line_to() this function will behave as ctx.moveTo(x, y)
         * 
         * @param x the X coordinate of the end of the new line
         * @param y the Y coordinate of the end of the new line
         */
        lineTo(x: number, y: number): void


        /**
         * Sets the current line width within the Context. The line width value specifies the diameter of a pen that is circular in user space, (though device-space pen may be an ellipse in general due to scaling/shear/rotation of the CTM).
         * 
         * Note: When the description above refers to user space and CTM it refers to the user space and CTM in effect at the time of the stroking operation, not the user space and CTM in effect at the time of the call to set_line_width(). The simplest usage makes both of these spaces identical. That is, if there is no change to the CTM between a call to set_line_width() and the stroking operation, then one can just pass user-space values to set_line_width() and ignore this note.
         * 
         * As with the other stroke parameters, the current line width is examined by stroke(), stroke_extents(), and stroke_to_path(), but does not have any effect during path construction.
         * 
         * The default line width value is 2.0.
         * 
         * @param width a line width;
         */
        setLineWidth(width: number): void


        /**
         * A drawing operator that strokes the current path according to the current line width, line join, line cap, and dash settings. After stroke(), the current path will be cleared from the cairo context. See set_line_width(), set_line_join(), set_line_cap(), set_dash(), and stroke_preserve().
         * 
         * Note: Degenerate segments and sub-paths are treated specially and provide a useful result. These can result in two different situations:
         * 
         * 1. Zero-length “on” segments set in set_dash(). If the cap style is cairo.LineCap.ROUND or cairo.LineCap.SQUARE then these segments will be drawn as circular dots or squares respectively. In the case of cairo.LineCap.SQUARE, the orientation of the squares is determined by the direction of the underlying path.
         * 
         * 2. A sub-path created by move_to() followed by either a close_path() or one or more calls to line_to() to the same coordinate as the move_to(). If the cap style is cairo.LineCap.ROUND then these sub-paths will be drawn as circular dots. Note that in the case of cairo.LineCap.SQUARE a degenerate sub-path will not be drawn at all, (since the correct orientation is indeterminate).
         * 
         * In no case will a cap style of cairo.LineCap.BUTT cause anything to be drawn in the case of either degenerate segments or sub-paths
         */
        stroke(): void

        $dispose(): void
    }

    class Gradient extends Pattern {

        /**
         * Adds a translucent color stop to a gradient pattern.
         * 
         * The offset specifies the location along the gradient's control vector. For example, a linear gradient's control vector is from (x0,y0) to (x1,y1) while a radial gradient's control vector is from any point on the start circle to the corresponding point on the end circle.
         * 
         * The color is specified in the same way as in Context::set_source_rgba().
         * 
         * If two (or more) stops are specified with identical offset values, they will be sorted according to the order in which the stops are added, (stops added earlier will compare less than stops added later). This can be useful for reliably making sharp color transitions instead of the typical blend.
         * 
         * @param offset an offset in the range [0.0 .. 1.0];
         * @param red 	red component of color
         * @param green green component of color
         * @param blue blue component of color
         * @param alpha alpha component of color
         */
        addColorStopRGBA(offset: number, red: number, green: number, blue: number, alpha: number): void

    }

    class LinearGradient extends Gradient {
        /**
         * Create a new linear gradient along the line defined by (x0, y0) and (x1, y1).
         * 
         * Before using the gradient pattern, a number of color stops should be defined 
         * using addColorStopRGB() or addColorStopRGBA().
         * 
         * Note: The coordinates here are in pattern space. For a new pattern, pattern space is 
         * identical to user space, but the relationship between the spaces can be changed with 
         * Cairo::Pattern::set_matrix().
         * 
         * @param x0 x coordinate of the start point
         * @param y0 y coordinate of the start point
         * @param x1 x coordinate of the end point
         * @param y1 y coordinate of the end point
         */
        constructor(x0: number, y0: number, x1: number, y1: number)

    }
}