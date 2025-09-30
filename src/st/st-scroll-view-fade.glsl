/*
 * st-scroll-view-fade.glsl: Edge fade effect for StScrollView
 *
 * Copyright 2010 Intel Corporation.
 * Copyright 2011 Adel Gadllah
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms and conditions of the GNU Lesser General Public License,
 * version 2.1, as published by the Free Software Foundation.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

uniform sampler2D tex;
uniform float height;
uniform float width;
uniform float vfade_offset;
uniform float hfade_offset;
uniform bool  fade_edges_top;
uniform bool  fade_edges_right;
uniform bool  fade_edges_bottom;
uniform bool  fade_edges_left;

uniform vec2 fade_area_topleft;
uniform vec2 fade_area_bottomright;

void main ()
{
    cogl_color_out = cogl_color_in * texture2D (tex, vec2 (cogl_tex_coord_in[0].xy));

    float y = height * cogl_tex_coord_in[0].y;
    float x = width * cogl_tex_coord_in[0].x;

    /*
     * We cannot just return here due to a bug in llvmpipe see:
     * https://bugzilla.freedesktop.org/show_bug.cgi?id=62357
     */
    if (x > fade_area_topleft[0] && x < fade_area_bottomright[0] &&
        y > fade_area_topleft[1] && y < fade_area_bottomright[1]) {
        float ratio = 1.0;
        float after_left = x - fade_area_topleft[0];
        float before_right = fade_area_bottomright[0] - x;
        float after_top = y - fade_area_topleft[1];
        float before_bottom = fade_area_bottomright[1] - y;

        if (after_top < vfade_offset && fade_edges_top) {
            ratio *= after_top / vfade_offset;
        }

        if (before_bottom < vfade_offset && fade_edges_bottom) {
            ratio *= before_bottom / vfade_offset;
        }

        if (after_left < hfade_offset && fade_edges_left) {
            ratio *= after_left / hfade_offset;
        }

        if (before_right < hfade_offset && fade_edges_right) {
            ratio *= before_right / hfade_offset;
        }

        cogl_color_out *= ratio;
    }
}
