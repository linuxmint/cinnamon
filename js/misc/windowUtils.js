const Clutter = imports.gi.Clutter;

// Creates scaled clones of metaWindow and its transients,
// keeping their relative size to each other.
// When scaled, the clone with the biggest width and the one with 
// the biggest height are made to fit into size
// if size is not given, windows are not scaled
function createWindowClone(metaWindow, size, withTransients, withPositions) {
    let clones = [];
    let textures = [];
    
    if (!metaWindow) {
      return clones;
    }
    
    let metaWindowActor = metaWindow.get_compositor_private();
    if (!metaWindowActor) {
      return clones;
    }
    let texture = metaWindowActor.get_texture();
    let [width, height] = metaWindowActor.get_size();
    let [maxWidth, maxHeight] = [width, height];
    let [x, y] = metaWindowActor.get_position();
    let [minX, minY] = [x, y];
    let [maxX, maxY] = [minX + width, minY + height];
    textures.push({t: texture, x: x, y: y, w: width, h: height});
    if (withTransients) {
      metaWindow.foreach_transient(function(win) {
        let metaWindowActor = win.get_compositor_private();
        texture = metaWindowActor.get_texture();
        [width, height] = metaWindowActor.get_size();
        [x, y] = metaWindowActor.get_position();
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + width);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + height);
        textures.push({t: texture, x: x, y: y, w: width, h: height});
      });
    }
    let scale = 1;
    if (size) {
      if (withPositions) {
        scale = Math.min(size/Math.max(maxX - minX, maxY - minY), 1);
      }
      else {
        scale = Math.min(size/Math.max(maxWidth, maxHeight), 1);
      }
    }
    for (i in textures) {
      let data = textures[i];
      let [texture, width, height, x, y] = [data.t, data.w, data.h, data.x, data.y];
      if (withPositions) {
        x -= minX;
        y -= minY;
      }
      let params = {};
      params.source = texture;
      if (scale != 1) {
        params.width = Math.round(width * scale);
        params.height = Math.round(height * scale);
        x = Math.round(x * scale);
        y = Math.round(y * scale);
      }
      let clone = {actor: new Clutter.Clone(params), x: x, y: y};
      clones.push(clone);
    }
    return clones;
}
