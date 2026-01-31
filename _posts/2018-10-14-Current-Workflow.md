---
title: "My Workflow"
date: 2018-10-14
permalink: /posts/2018/10/current-workflow/
tags:
  - workflow
  - reproducibility
  - git
---

We work with data on a lab server, basically network attached storage...
There is no ftp access or any other web service integrations, so we do not treat it as our own private git server.
However, I am "softly" mimicking that functionality in my current workflow.
Once I've generated data I want to analyze/explore on the server (via some heavy data chugging analysis through the cluster), I can make the output directory a git repository and clone it locally.
Since multiple people can access the server at the same time, this is useful as to not step on each other's toes as we access/modify data.
When I'm done fooling around locally, I can try to push, but since the repository I cloned from isn't `bare`, I can't.
To get around that I had to use this command (that I stole from [stack overflow]( https://stackoverflow.com/questions/1764380/how-to-push-to-a-non-bare-git-repository)):

```bash
git config --local receive.denyCurrentBranch updateInstead
```

And now I can push to the server git repo.
We can also benefit from branches if multiple people are working on the data at the same time.

In addition, I can make a python environment with conda, and wrap up any python notebooks I make with a yml file that means anyone else (obstensibly) can replicate my environment and run the code (reproducible!)
