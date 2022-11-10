#!/usr/bin/python3

"""
    made with the file cjs/tweener/equations.js

    Original copyright notice of the source file:

    Copyright 2008 litl, LLC.

    Equations
    Main equations for the Tweener class

    @author              Zeh Fernando, Nate Chatellier
    @version             1.0.2

    Disclaimer for Robert Penner's Easing Equations license:

    TERMS OF USE - EASING EQUATIONS

    Open source under the BSD License.

    Copyright (c) 2001 Robert Penner
    All rights reserved.

    Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
    * Neither the name of the author nor the names of contributors may be used to endorse or promote products derived from this software without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

    TWEENING EQUATIONS functions
    (the original equations are Robert Penner's work as mentioned on the disclaimer)
"""

from __future__ import division
import math

def easeNone(t, b, c, d):
    return c * t / d + b


def easeInQuad(t, b, c, d):
    t /= d
    return c * t * t + b


def easeOutQuad(t, b, c, d):
    t /= d
    return -c * t * (t - 2) + b


def easeInOutQuad(t, b, c, d):
    t /= d / 2
    if t < 1:
        return c / 2 * t * t + b
    t -= 1
    return -c / 2 * (t * (t - 2) - 1) + b


def easeOutInQuad(t, b, c, d):
    if t < d / 2:
        return easeOutQuad(t * 2, b, c / 2, d)
    return easeInQuad((t * 2) - d, b + c / 2, c / 2, d)


def easeInCubic(t, b, c, d):
    t /= d
    return c * t ** 3 + b


def easeOutCubic(t, b, c, d):
    t = t / d - 1
    return c * (t ** 3 + 1) + b


def easeInOutCubic(t, b, c, d):
    t /= d / 2
    if t < 1:
        return c / 2 * t ** 3 + b
    t -= 2
    return c / 2 * (t ** 3 + 2) + b


def easeOutInCubic(t, b, c, d):
    if t < d / 2:
        return easeOutCubic (t * 2, b, c / 2, d)
    return easeInCubic((t * 2) - d, b + c / 2, c / 2, d)


def easeInQuart(t, b, c, d):
    t /= d
    return c * t ** 4 + b


def easeOutQuart(t, b, c, d):
    t = t / d - 1
    return -c * (t ** 4 - 1) + b


def easeInOutQuart(t, b, c, d):
    t /= d / 2
    if t < 1:
        return c / 2 * t ** 4 + b
    t -= 2
    return -c / 2 * (t ** 4 - 2) + b


def easeOutInQuart(t, b, c, d):
    if t < d / 2:
        return easeOutQuart(t * 2, b, c / 2, d)
    return easeInQuart((t * 2) - d, b + c / 2, c / 2, d)


def easeInQuint(t, b, c, d):
    t /= d
    return c * t ** 5 + b


def easeOutQuint(t, b, c, d):
    t = t / d - 1
    return c * (t ** 5 + 1) + b


def easeInOutQuint(t, b, c, d):
    t /= d / 2
    if t < 1:
        return c / 2 * t ** 5 + b
    t -= 2
    return c / 2 * (t ** 5 + 2) + b


def easeOutInQuint(t, b, c, d):
    if t < d / 2:
        return easeOutQuint (t * 2, b, c / 2, d)
    return easeInQuint((t * 2) - d, b + c / 2, c / 2, d)


def easeInSine(t, b, c, d):
    return -c * math.cos(t / d * (math.pi / 2)) + c + b


def easeOutSine(t, b, c, d):
    return c * math.sin(t / d * (math.pi / 2)) + b


def easeInOutSine(t, b, c, d):
    return -c / 2 * (math.cos(math.pi * t / d) - 1) + b


def easeOutInSine(t, b, c, d):
    if t < d / 2:
        return easeOutSine(t * 2, b, c / 2, d)
    return easeInSine((t * 2) - d, b + c / 2, c / 2, d)


def easeInExpo(t, b, c, d):
    if t <= 0:
        return b
    return c * pow(2, 10 * (t / d - 1)) + b


def easeOutExpo(t, b, c, d):
    if t >= d:
        return b + c
    return c * (-pow(2, -10 * t / d) + 1) + b


def easeInOutExpo(t, b, c, d):
    if t <= 0:
        return b
    if t >= d:
        return b + c
    t /= d / 2
    if t < 1:
        return c / 2 * pow(2, 10 * (t - 1)) + b
    return c / 2 * (-pow(2, -10 * (t - 1)) + 2) + b


def easeOutInExpo(t, b, c, d):
    if t < d / 2:
        return easeOutExpo (t * 2, b, c / 2, d)
    return easeInExpo((t * 2) - d, b + c / 2, c / 2, d)


def easeInCirc(t, b, c, d):
    t /= d
    return -c * (math.sqrt(1 - t * t) - 1) + b


def easeOutCirc(t, b, c, d):
    t = t / d - 1
    return c * math.sqrt(1 - t * t) + b


def easeInOutCirc(t, b, c, d):
    t /= d / 2
    if t < 1:
        return -c / 2 * (math.sqrt(1 - t * t) - 1) + b
    t -= 2
    return c / 2 * (math.sqrt(1 - t * t) + 1) + b


def easeOutInCirc(t, b, c, d):
    if t < d / 2:
        return easeOutCirc(t * 2, b, c / 2, d)
    return easeInCirc((t * 2) - d, b + c / 2, c / 2, d)


def easeInElastic(t, b, c, d):
    if t <= 0:
        return b
    t /= d
    if t >= 1:
        return b + c
    p = d * .3
    a = c
    s = p / 4
    t -= 1
    return -(a * pow(2, 10 * t) * math.sin((t * d - s) * (2 * math.pi) / p)) + b


def easeOutElastic(t, b, c, d):
    if t <= 0:
        return b
    t /= d
    if t >= 1:
        return b + c
    p = d * .3
    a = c
    s = p / 4
    return a * pow(2, -10 * t) * math.sin((t * d - s) * 2 * math.pi / p) + c + b


def easeInOutElastic(t, b, c, d):
    if t <= 0:
        return b
    t /= d / 2
    if t >= 2:
        return b + c
    p = d * (.3 * 1.5)
    s = p / 4
    a = c
    if t < 1:
        t -= 1
        return -.5 * (a * pow(2, (10 * t)) * math.sin((t * d - s) * 2 * math.pi / p)) + b
    t -= 1
    return a * pow(2, (-10 * t)) * math.sin((t * d - s) * 2 * math.pi / p) * .5 + c + b


def easeOutInElastic(t, b, c, d):
    if t < d / 2:
        return easeOutElastic (t * 2, b, c / 2, d)
    return easeInElastic((t * 2) - d, b + c / 2, c / 2, d)


def easeInBack(t, b, c, d):
    s = 1.70158
    t /= d
    return c * t * t * ((s + 1) * t - s) + b


def easeOutBack(t, b, c, d):
    s = 1.70158
    t = t / d - 1
    return c * (t * t * ((s + 1) * t + s) + 1) + b


def easeInOutBack(t, b, c, d):
    s = 1.70158 * 1.525
    t /= d / 2
    if t < 1:
        return c / 2 * (t * t * ((s + 1) * t - s)) + b
    t -= 2
    return c / 2 * (t * t * ((s + 1) * t + s) + 2) + b


def easeOutInBack(t, b, c, d):
    if t < d / 2:
        return easeOutBack (t * 2, b, c / 2, d)
    return easeInBack((t * 2) - d, b + c / 2, c / 2, d)


def easeInBounce(t, b, c, d):
    return c - easeOutBounce (d - t, 0, c, d) + b


def easeOutBounce(t, b, c, d):
    t /= d
    if t < (1 / 2.75):
        return c * (7.5625 * t * t) + b
    elif t < (2 / 2.75):
        t -= (1.5 / 2.75)
        return c * (7.5625 * t * t + .75) + b
    elif t < (2.5 / 2.75):
        t -= (2.25 / 2.75)
        return c * (7.5625 * t * t + .9375) + b
    t -= (2.625 / 2.75)
    return c * (7.5625 * t * t + .984375) + b


def easeInOutBounce(t, b, c, d):
    if t < d / 2:
        return easeInBounce (t * 2, 0, c, d) * .5 + b
    return easeOutBounce (t * 2 - d, 0, c, d) * .5 + c*.5 + b


def easeOutInBounce(t, b, c, d):
    if t < d / 2:
        return easeOutBounce (t * 2, b, c / 2, d)
    return easeInBounce((t * 2) - d, b + c / 2, c / 2, d)
