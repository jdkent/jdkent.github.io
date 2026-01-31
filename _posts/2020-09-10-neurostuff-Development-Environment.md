---
title: "Neurostuff Development Environment"
date: 2020-09-10
permalink: /posts/2020/09/neurostuff-development-environment/
tags:
  - development
  - containers
  - vscode
---

This post is a chronicle of how I'm setting up a development environment for [neurostuff](https://github.com/PsychoinformaticsLab/neurostuff) using [VSCode](https://code.visualstudio.com/) (version 1.48.2 as of this writing).

## Prerequisites

- [VSCode installed](https://code.visualstudio.com/download)
  - ["Remote - Containers" extension installed](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
  - [Docker extension installed](https://code.visualstudio.com/docs/containers/overview)
- [docker installed](https://docs.docker.com/get-docker/)

## Step 0: clone the repository

clone the repository
```
git clone https://github.com/PsychoinformaticsLab/neurostuff.git
```

and then `cd` into the created folder.
```
cd neurostuff
```

## Step 1: Open VSCode

open vscode
```
code .
```

## Step 2: Generate the Container Files

Click on the lower lefthand green section of the
VSCode bottom banner.

![](/assets/imgs/00-remote_container.jpg)

That will open a menu where you will select
`Remote-Containers: Add Development Container Configuration Files...`

![](/assets/imgs/01-remote_container.jpg)

which progresses the menu to the next choice of which file
to use to build the container.
You will select `From 'docker-compose.yml'`.

![](/assets/imgs/02-remote_container.jpg)

The next menu will ask which service you wish to create,
you will select `neurostuff`.

![](/assets/imgs/03-remote_container.jpg)

Following those choices should result in a folder named
`.devcontainer` with two files:
1. `devcontainer.json`
2. `docker-compose.yml`

![](/assets/imgs/04-remote_container.jpg)

## Step 2: Edit devcontainer.json

There are several edits needed to setup `devcontainer.json`
for the neurostuff repository.

The first field to edit in `devcontainer.json` is `dockerComposeFile`:

![](/assets/imgs/05-remote_container.jpg)

within neurostuff, there is an additional `docker-compose.dev.yml`
file to add.

![](/assets/imgs/06-remote_container.jpg)

The second field to edit in `devcontainer.json` is `workspaceFolder`,
which by default is `/workspace`.

![](/assets/imgs/07-remote_container.jpg)


Change `/workspace` to `/neurostuff`

![](/assets/imgs/08-remote_container.jpg)

Finally, the third field we want to edit is `extensions`.
`neurostuff is written in python, so we want the python extension to
be installed with vscode on this remote container.
Add `ms-python.python` to `extensions`.

![](/assets/imgs/09-remote_container.jpg)


## Step 3: Edit docker-compose.yml

Within `docker-compose.yml` we will change the 
`volumes` mount from `/workspace` to `/neurostuff`

![](/assets/imgs/10-remote_container.jpg)

## Step 4: Open VSCode with the remote container

Click on the left corner in the green section
of the bottom banner again.

![](/assets/imgs/11-remote_container.jpg)

Select `Remote-Containers: Reopen in Container`

![](/assets/imgs/12-remote_container.jpg)

Once the images are built and the containers
are created, you should be working from within
the `neurostuff` container, yay!

![](/assets/imgs/13-remote_container.jpg)

## Step 5: Setup python testing

Press `Ctrl+Shift+P` and type into the
menu bar: `Python: Configure Tests`

![](/assets/imgs/00-python_testing.jpg)

`neurostuff` uses `pytest` so we will select `pytest` as our test framework.

![](/assets/imgs/14-remote_container.jpg)

When the menu progresses, select `neurostuff`
as the base directory.

![](/assets/imgs/01-python_testing.jpg)

The menu should close and VSCode will find
all tests written for `neurostuff` and you
will see a new icon that looks like a beaker.

![](/assets/imgs/02-python_testing.jpg)

To try debugging a test, create a breakpoint in
one of the test files.

![](/assets/imgs/03-python_testing.jpg)

then click on `Debug Test` above the test function.

![](/assets/imgs/04-python_testing.jpg)

Clicking `Debug Test` should run the test until it reaches the breakpoint at which point
you have total control to inspect variables and test your understanding.

![](/assets/imgs/05-python_testing.jpg)

## Additional Reading

- [developing in a container](https://code.visualstudio.com/docs/remote/containers)
- [testing python in vscode](https://code.visualstudio.com/docs/python/testing)
