#version 110
uniform sampler2D tex;
uniform float fraction;
uniform float height;
const float c = -0.2;
const float border_max_height = 60.0;

mat4 contrast = mat4 (1.0 + c, 0.0, 0.0, 0.0,
                      0.0, 1.0 + c, 0.0, 0.0,
                      0.0, 0.0, 1.0 + c, 0.0,
                      0.0, 0.0, 0.0, 1.0);
vec4 off = vec4(0.633, 0.633, 0.633, 0);
void main()
{
  vec4 color = texture2D(tex, cogl_tex_coord_in[0].xy);
  float y = height * cogl_tex_coord_in[0].y;

  // To reduce contrast, blend with a mid gray
  cogl_color_out = color * contrast - off * c * color.a;

  // We only fully dim at a distance of BORDER_MAX_HEIGHT from the top and
  // when the fraction is 1.0. For other locations and fractions we linearly
  // interpolate back to the original undimmed color, so the top of the window
  // is at full color.
  cogl_color_out = color + (cogl_color_out - color) * max(min(y / border_max_height, 1.0), 0.0);
  cogl_color_out = color + (cogl_color_out - color) * fraction;
}
