// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const Params = imports.misc.params;
const Tweener = imports.ui.tweener;

var VIGNETTE_BRIGHTNESS = 0.5;
var VIGNETTE_SHARPNESS = 0.7;

const VIGNETTE_DECLARATIONS = '\
uniform float brightness;\n\
uniform float vignette_sharpness;\n';

const VIGNETTE_CODE = '\
cogl_color_out.a = cogl_color_in.a;\n\
cogl_color_out.rgb = vec3(0.0, 0.0, 0.0);\n\
vec2 position = cogl_tex_coord_in[0].xy - 0.5;\n\
float t = length(2.0 * position);\n\
t = clamp(t, 0.0, 1.0);\n\
float pixel_brightness = mix(1.0, 1.0 - vignette_sharpness, t);\n\
cogl_color_out.a = cogl_color_out.a * (1 - pixel_brightness * brightness);';
;

var RadialShaderQuad = GObject.registerClass(
class RadialShaderQuad extends Cinnamon.GLSLQuad {
    _init(params) {
        super._init(params);

        this._brightnessLocation = this.get_uniform_location('brightness');
        this._sharpnessLocation = this.get_uniform_location('vignette_sharpness');

        this.brightness = 1.0;
        this.vignetteSharpness = 0.0;
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cinnamon.SnippetHook.FRAGMENT,
                              VIGNETTE_DECLARATIONS, VIGNETTE_CODE, true);
    }

    get brightness() {
        return this._brightness;
    }

    set brightness(v) {
        this._brightness = v;
        this.set_uniform_float(this._brightnessLocation,
                               1, [this._brightness]);
    }

    get vignetteSharpness() {
        return this._sharpness;
    }

    set vignetteSharpness(v) {
        this._sharpness = v;
        this.set_uniform_float(this._sharpnessLocation,
                               1, [this._sharpness]);
    }
});

/**
 * Lightbox:
 * @container: parent Clutter.Container
 * @params: (optional) additional parameters:
 *           - inhibitEvents: whether to inhibit events for @container
 *           - width: shade actor width
 *           - height: shade actor height
 *           - fadeTime: seconds used to fade in/out
 *
 * Lightbox creates a dark translucent "shade" actor to hide the
 * contents of @container, and allows you to specify particular actors
 * in @container to highlight by bringing them above the shade. It
 * tracks added and removed actors in @container while the lightboxing
 * is active, and ensures that all actors are returned to their
 * original stacking order when the lightboxing is removed. (However,
 * if actors are restacked by outside code while the lightboxing is
 * active, the lightbox may later revert them back to their original
 * order.)
 *
 * By default, the shade window will have the height and width of
 * @container and will track any changes in its size. You can override
 * this by passing an explicit width and height in @params.
 */
var Lightbox = class Lightbox {
    constructor(container, params) {
        params = Params.parse(params, { inhibitEvents: false,
                                        width: null,
                                        height: null,
                                        fadeTime: null,
                                        radialEffect: false,
                                      });

        this._container = container;
        this._children = container.get_children();
        this._fadeTime = params.fadeTime;
        this._radialEffect = Clutter.feature_available(Clutter.FeatureFlags.SHADERS_GLSL) && params.radialEffect;
        if (this._radialEffect)
            this.actor = new RadialShaderQuad({ reactive: params.inhibitEvents });
        else
            this.actor = new St.Bin({ opacity: 0,
                                      style_class: 'lightbox',
                                      reactive: params.inhibitEvents });

        container.add_actor(this.actor);
        this.actor.raise_top();
        this.actor.hide();

        this.actor.connect('destroy', this._onDestroy.bind(this));

        if (params.width && params.height) {
            this.actor.width = params.width;
            this.actor.height = params.height;
        } else {
            this.actor.width = container.width;
            this.actor.height = container.height;
            let constraint = new Clutter.BindConstraint({ source: container,
                                                          coordinate: Clutter.BindCoordinate.ALL });
            this.actor.add_constraint(constraint);
        }

        this._actorAddedSignalId = container.connect('actor-added', this._actorAdded.bind(this));
        this._actorRemovedSignalId = container.connect('actor-removed', this._actorRemoved.bind(this));

        this._highlighted = null;
    }

    _actorAdded(container, newChild) {
        let children = this._container.get_children();
        let myIndex = children.indexOf(this.actor);
        let newChildIndex = children.indexOf(newChild);

        if (newChildIndex > myIndex) {
            // The child was added above the shade (presumably it was
            // made the new top-most child). Move it below the shade,
            // and add it to this._children as the new topmost actor.
            newChild.lower(this.actor);
            this._children.push(newChild);
        } else if (newChildIndex == 0) {
            // Bottom of stack
            this._children.unshift(newChild);
        } else {
            // Somewhere else; insert it into the correct spot
            let prevChild = this._children.indexOf(children[newChildIndex - 1]);
            if (prevChild != -1) // paranoia
                this._children.splice(prevChild + 1, 0, newChild);
        }
    }

    show() {
        if (this._radialEffect) {
            Tweener.addTween(this.actor,
                             { brightness: VIGNETTE_BRIGHTNESS,
                               vignetteSharpness: VIGNETTE_SHARPNESS,
                               time: this._fadeTime,
                               transition: 'easeOutQuad'
                             });
        } else {
            this.actor.opacity = 0;
            Tweener.addTween(this.actor,
                             { opacity: 255,
                               time: this._fadeTime,
                               transition: 'easeOutQuad',
                             });
        }
        this.actor.show();
    }

    hide() {
        if (this._radialEffect) {
            Tweener.addTween(this.actor,
                             { brightness: 1.0,
                               vignetteSharpness: 0.0,
                               opacity: 0,
                               time: this._fadeTime,
                               transition: 'easeOutQuad',
                             });
        } else {
            Tweener.addTween(this.actor,
                             { opacity: 0,
                               time: this._fadeTime,
                               transition: 'easeOutQuad',
                               onComplete: () => {
                                   this.actor.hide();
                               }
                             });
        }
    }

    _actorRemoved(container, child) {
        let index = this._children.indexOf(child);
        if (index != -1) // paranoia
            this._children.splice(index, 1);

        if (child == this._highlighted)
            this._highlighted = null;
    }

    /**
     * highlight:
     * @window: actor to highlight
     *
     * Highlights the indicated actor and unhighlights any other
     * currently-highlighted actor. With no arguments or a false/null
     * argument, all actors will be unhighlighted.
     */
    highlight(window) {
        if (this._highlighted == window)
            return;

        // Walk this._children raising and lowering actors as needed.
        // Things get a little tricky if the to-be-raised and
        // to-be-lowered actors were originally adjacent, in which
        // case we may need to indicate some *other* actor as the new
        // sibling of the to-be-lowered one.

        let below = this.actor;
        for (let i = this._children.length - 1; i >= 0; i--) {
            if (this._children[i] == window)
                this._children[i].raise_top();
            else if (this._children[i] == this._highlighted)
                this._children[i].lower(below);
            else
                below = this._children[i];
        }

        this._highlighted = window;
    }

    /**
     * destroy:
     *
     * Destroys the lightbox.
     */
    destroy() {
        this.actor.destroy();
    }

    /**
     * _onDestroy:
     *
     * This is called when the lightbox' actor is destroyed, either
     * by destroying its container or by explicitly calling this.destroy().
     */
    _onDestroy() {
        this._container.disconnect(this._actorAddedSignalId);
        this._container.disconnect(this._actorRemovedSignalId);

        this.highlight(null);
    }
};
