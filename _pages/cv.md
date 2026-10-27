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
- **NeuroSynth 2.0 Technical Lead** (2020–present), University of Texas at Austin / Neuroinformagic Lab — lead development and release engineering across NeuroStore and Neurosynth Compose, including restartable, fingerprint-cached literature ingestion and the OpenAPI-driven Python/TypeScript SDK release pipeline. Recent releases include [NeuroStore v0.23.3](https://github.com/neurostuff/neurostore/releases/tag/v0.23.3), [Compose Runner v0.14.5](https://github.com/neurostuff/compose-runner/releases/tag/0.14.5), and [NeuroStore Python SDK v1.2](https://github.com/neurostuff/neurostore-python-sdk/releases/tag/v1.2).
- **Lead Developer & Maintainer, NiMARE ecosystem** (2020–present), Open Neuroimaging Tools Consortium — coordinate- and image-based neuroimaging meta-analysis software, sustainable releases, testing, and contributor onboarding. Recent releases: [v0.22.1](https://github.com/neurostuff/NiMARE/releases/tag/0.22.1) and [v0.22.0](https://github.com/neurostuff/NiMARE/releases/tag/0.22.0), with contributions spanning inference corrections, decoders, image transforms, and studyset data handling; also contributed to [PyMARE v0.0.13](https://github.com/neurostuff/PyMARE/releases/tag/0.0.13).

Education
======
- **PhD, Neuroscience** (2014–2020), University of Iowa — Advisor: Michelle W. Voss
- **BA, Psychology (Neuroscience concentration)** (2010–2014), Grinnell College

Award applications
======
- NIH Research Specialist Award (R50) — application submitted (2026)

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

Selected media and interviews
======
- [How AI Maps Brain Activity from Text Across 30,000 Studies](https://faculti.net/how-ai-maps-brain-activity-from-text-across-30000-studies) — Faculti interview discussing NeuroVLM and Neurosynth Compose.
- [From Data to Discovery: James Kent Pioneers Next-Generation Neuroimaging Meta-Analyses](https://neuroscience.grad.uiowa.edu/news/2026/02/data-discovery-james-kent-pioneers-next-generation-neuroimaging-meta-analyses) — University of Iowa Neuroscience Graduate Program, 2026.

Digital outreach
======
- Channel administrator and contributor (2025–present), NeuroSynth Organization: publish project updates through the organization's [YouTube](https://www.youtube.com/@NeurosynthOrganization), [Bluesky](https://bsky.app/profile/neurosynth.bsky.social), and [LinkedIn](https://www.linkedin.com/company/143416915/) channels.
  
Teaching
======
  <ul>{% for post in site.teaching reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Service and leadership (selected)
======
- OHBM Open Science Room Chair (2025–2026); organizer and moderator of multiple 2026 sessions on open science practice, community building, and scientific communication.
