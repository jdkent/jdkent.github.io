---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Download
======
- [CV (PDF)]({{ base_path }}/files/James-Kent-CV.pdf){:target="_blank"}

Positions
======
- **NeuroSynth 2.0 Technical Lead** (2020–present), University of Texas at Austin / Neuroinformagic Lab
- **Lead Developer & Maintainer, NiMARE ecosystem** (2020–present), Open Neuroimaging Tools Consortium

Education
======
- **PhD, Neuroscience** (2014–2020), University of Iowa — Advisor: Michelle W. Voss
- **BA, Psychology (Neuroscience concentration)** (2010–2014), Grinnell College

Focus areas
======
- Research software engineering for reproducible neuroimaging and meta-analysis
- Open data infrastructure, standards, and community tools
- Mentoring, workshops, and open science community leadership

Publications
======
  <ul>{% for post in site.publications reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Talks
======
  <ul>{% for post in site.talks reversed %}
    {% include archive-single-talk-cv.html  %}
  {% endfor %}</ul>
  
Teaching
======
  <ul>{% for post in site.teaching reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Service and leadership (selected)
======
- OHBM Open Science Room Chair (2025–2026)
