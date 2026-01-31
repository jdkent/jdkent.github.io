---
title: "Development Environment with VS Code"
date: 2019-06-26
permalink: /posts/2019/06/fmriprep-development-environment/
tags:
  - fmriprep
  - development
  - vscode
---

Often times you have to choose between installing the complex web of
dependencies to debug fmriprep from a graphical text editor and using a
container where you can only debug from a terminal. [VS
Code](https://code.visualstudio.com/download) has several extensions
that make it easier to develop fmriprep and have the best of both
worlds. The [VS Code
Docker](https://code.visualstudio.com/docs/azure/docker) and [Remote
Development](https://code.visualstudio.com/docs/remote/remote-overview)
extensions will give you a great experience running tests and debugging
fmriprep on your laptop or work machine.

## 1. Download Test Data

To test fmriprep, we use test data modified from openneuro datasets. We
will download the data in a `downloads` folder at the project root:

    $ mkdir -p ./downloads && cd ./downloads

Then using a script similar to the one below, we download all necessary
data into the downloads folder:

```
mkdir -p data/reports

# regression data for pytest
if [[ ! -d data/fmriprep_bold_truncated ]]; then
    wget --retry-connrefused --waitretry=5 --read-timeout=20 --timeout=15 -t 0 -q \
    -O fmriprep_bold_truncated.tar.gz "https://osf.io/286yr/download"
    tar xvzf fmriprep_bold_truncated.tar.gz -C data
else
    echo "Truncated BOLD series were already downloaded"
fi

if [[ ! -d data/fmriprep_bold_mask ]]; then
    wget --retry-connrefused --waitretry=5 --read-timeout=20 --timeout=15 -t 0 -q \
    -O fmriprep_bold_mask.tar.gz "https://osf.io/s4f7b/download"
    tar xvzf fmriprep_bold_mask.tar.gz -C data
else
    echo "Pre-computed masks were already downloaded"
fi

# data for test fmriprep runs
if [[ ! -d data/ds005 ]]; then
    wget --retry-connrefused --waitretry=5 --read-timeout=20 --timeout=15 -t 0 -q \
    -O ds005_downsampled.tar.gz "https://files.osf.io/v1/resources/fvuh8/providers/osfstorage/57f32a429ad5a101f977eb75"
    tar xvzf ds005_downsampled.tar.gz -C data
else
    echo "Dataset ds000005 was already downloaded"
fi

if [[ ! -d data/ds054 ]]; then
    wget --retry-connrefused --waitretry=5 --read-timeout=20 --timeout=15 -t 0 -q \
    -O ds054_downsampled.tar.gz "https://files.osf.io/v1/resources/fvuh8/providers/osfstorage/57f32c22594d9001ef91bf9e"
    tar xvzf ds054_downsampled.tar.gz -C data
else
    echo "Dataset ds000054 was already downloaded"
fi

if [[ ! -d data/ds210 ]]; then
    wget --retry-connrefused --waitretry=5 --read-timeout=20 --timeout=15 -t 0 -q \
    -O ds210_downsampled.tar.gz "https://files.osf.io/v1/resources/fvuh8/providers/osfstorage/5ae9e37b9a64d7000ce66c21"
    tar xvzf ds210_downsampled.tar.gz -C data
else
    echo "Dataset ds000210 was already downloaded"
fi

if [[ ! -d ds005/derivatives/freesurfer ]]; then
    mkdir -p ds005/derivatives
    wget --retry-connrefused --waitretry=5 --read-timeout=20 --timeout=15 -t 0 -q \
    -O ds005_derivatives_freesurfer.tar.gz "https://files.osf.io/v1/resources/fvuh8/providers/osfstorage/58fe59eb594d900250960180"
    tar xvzf ds005_derivatives_freesurfer.tar.gz -C ds005/derivatives
else
    echo "FreeSurfer derivatives of ds000005 were already downloaded"
fi
```

## 2. Install Prerequisite Software


-   [Docker](https://docs.docker.com/install/#supported-platforms)
-   [VS Code](https://code.visualstudio.com/download)
    -   we can type `code` in the terminal to open VS Code.
-   [Docker extension](https://code.visualstudio.com/docs/azure/docker)
-   [Remote Development
    extension](https://code.visualstudio.com/docs/remote/remote-overview)

You can see the [documentation for installing VS Code
extensions](https://code.visualstudio.com/docs/editor/extension-gallery)

## 3. Create .devcontainer.json

`.devcontainer.json` specifies how we build our development environment.
the file lives in the root (i.e. top) directory of the fmriprep
repository at the same level as the `Dockerfile`.

We are following the directions given by VS Code to create a
[development
environment](https://code.visualstudio.com/docs/remote/containers#_using-a-dockerfile)
with a `Dockerfile`.

To create the `.devcontainer.json` we will open VS Code in the root of
the fmriprep project:

    $ cd $HOME/projects/fmriprep
    $ code .

Once VS Code is open, we will press `Ctrl+Shift+P` on the keyboard and
type `Remote-Containers: Create Container Configuration File`. Selecting
that command will create a `.devcontainer.json` for us, but we will
change the json file to meet our needs.

The contents of `.devcontainer.json` will look like the following:

```
// See https://aka.ms/vscode-remote/devcontainer.json for format details.
{
    "name": "fmriprep_dev",
    "image": "fmriprep:dev",
    "dockerFile": "Dockerfile",
    "workspaceMount": "src=${env:PWD},dst=/src/fmriprep,type=bind",
    "workspaceFolder": "/src/fmriprep",
    "extensions": [
        "ms-python.python",
        "visualstudioexptteam.vscodeintellicode"
    ],
    "runArgs": ["--entrypoint", "",
                "-v", "${env:PWD}/downloads:/tmp",
                "-e", "FMRIPREP_REGRESSION_SOURCE=/tmp/data/fmriprep_bold_truncated",
                "-e", "FMRIPREP_REGRESSION_TARGETS=/tmp/data/fmriprep_bold_mask",
                "-e", "FMRIPREP_REGRESSION_REPORTS=/tmp/data/reports",
                "-e", "FS_LICENSE=/tmp/license.txt",
                "-e", "FMRIPREP_DEV=1"],
    "postCreateCommand": "pip uninstall -y fmriprep && python setup.py develop && conda install -y flake8 && cd /tmp && echo 'cHJpbnRmICJrcnp5c3p0b2YuZ29yZ29sZXdza2lAZ21haWwuY29tXG41MTcyXG4gKkN2dW12RVYzelRmZ1xuRlM1Si8yYzFhZ2c0RVxuIiA+IGxpY2Vuc2UudHh0Cg==' | base64 -d | sh"
}
```

The [keys are
documented](https://aka.ms/vscode-remote/devcontainer.json) so we will
not re-hash them here, but we will explain the motivation for the values
referenced by some of the keys.

-   We changed the default `workspaceMount` to bind our local fmriprep
    repository to the container.
-   Similarly, we changed the `workspaceFolder` to open VS Code in the
    correct directory where our local fmriprep repository is now bound.
-   We installed two essential plugins for working with the code:
    `ms-python.python` and `visualstudioexptteam.vscodeintellicode`.
    -   `ms-python.python` helps with debugging, linting, intellisense,
        etc. for python.

    - `visualstudioexptteam.vscodeintellicode` helps with code
    completion based on common code patterns.

-   The `runArgs` removes the entrypoint for the container (it was set
    to only run fmriprep), mounts data downloaded from step 1, and sets
    environment variables for the container to know where the test data
    should be and that we are in a testing environment.
-   The `postCreateCommand` performs three miscellaneous tasks:

    -   reinstalls fmriprep under development mode so edits in
            `/src/fmriprep` make a difference in the call to `fmriprep`
            (as opposed to patching as we\'ve seen in the above
            sections).
    -   installs flake8 for code linting in VS Code.
    -   creates a freesurfer licence file in `/tmp`, which is
            necessary to run fmriprep with freesurfer.

## 4. Create Container Environment

press `Ctrl+Shift+P` on the keyboard and type/select
`Remote-Containers: Open Folder in Container` This should open a folder
browser. Navigate to your fmriprep project folder and select `open`. The
build process should begin.

## 5a. Setup Debugging with .vscode/launch.json

`.vscode/launch.json` is a file that helps VS Code run debugging
sessions. Go to the debug view in the [activity
bar](https://code.visualstudio.com/docs/editor/debugging#_debug-view) on
the side of VS Code. From the debug view, select the configure [gear
icon](https://code.visualstudio.com/docs/editor/debugging#_launch-configurations)
on the Debug view top bar.

`.vscode/launch.json` should now exist and have a couple default
entries. We will remove those entries and replace them with the
following:

```
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [

        {
            "name": "python: ds005-anat",
            "type": "python",
            "request": "launch",
            "program": "/usr/local/miniconda/bin/fmriprep",
            "args": [
                "-w", "/tmp/ds005/work",
                "/tmp/data/ds005",
                "/tmp/ds005/derivatives",
                "participant",
                "--skull-strip-template", "OASIS30ANTs:res-1",
                "--output-spaces", "MNI152NLin2009cAsym", "MNI152NLin6Asym",
                "--sloppy", "--write-graph",
                "--anat-only", "-vv", "--notrack"
            ],
            "console": "integratedTerminal",
            "justMyCode": false
        },
        {
            "name": "python: ds005-full",
            "type": "python",
            "request": "launch",
            "program": "/usr/local/miniconda/bin/fmriprep",
            "args": [
                "-w", "/tmp/ds005/work",
                "/tmp/data/ds005",
                "/tmp/ds005/derivatives",
                "participant",
                "--sloppy", "--write-graph",
                "--use-aroma",
                "--skull-strip-template", "OASIS30ANTs:res-1",
                "--output-space", "T1w", "template", "fsaverage5", "fsnative",
                "--template-resampling-grid",  "native",
                "--use-plugin", "/src/fmriprep/.circleci/legacy.yml",
                "--cifti-output", "-vv", "--notrack"
            ],
            "console": "integratedTerminal",
            "justMyCode": false
        },
        {
            "name": "python: ds054",
            "type": "python",
            "request": "launch",
            "program": "/usr/local/miniconda/bin/fmriprep",
            "args": [
                "-w", "/tmp/ds054/work",
                "/tmp/data/ds054",
                "/tmp/ds054/derivatives",
                "participant",
                "--fs-no-reconall", "--sloppy",
                "--output-spaces", "MNI152NLin2009cAsym:res-2", "anat", "func",
                "-vv",
                "--notrack"
            ],
            "console": "integratedTerminal",
            "justMyCode": false
        },
        {
            "name": "python: ds210-anat",
            "type": "python",
            "request": "launch",
            "program": "/usr/local/miniconda/bin/fmriprep",
            "args": [
                "-w", "/tmp/ds210/work",
                "/tmp/data/ds210",
                "/tmp/ds210/derivatives",
                "participant",
                "--fs-no-reconall", "--sloppy", "--write-graph",
                "--anat-only", "-vv", "--notrack"
            ],
            "console": "integratedTerminal",
            "justMyCode": false
        },
        {
            "name": "python: ds210-full",
            "type": "python",
            "request": "launch",
            "program": "/usr/local/miniconda/bin/fmriprep",
            "args": [
                "-w", "/tmp/ds210/work",
                "/tmp/data/ds210",
                "/tmp/ds210/derivatives",
                "participant",
                "--t2s-coreg", "--use-syn-sdc",
                "--template-resampling-grid", "native",
                "--dummy-scans", "1",
                "--fs-no-reconall", "--sloppy", "--write-graph",
                "--anat-only", "-vv", "--notrack"
            ],
            "console": "integratedTerminal",
            "justMyCode": false
        }
    ]
}
```

After adding those entries, you should be able to hit the green arrow
and debug any changes you made to fmriprep.

You can edit this file to test on your own data or some other
configuration. Please see [python
debugging](https://code.visualstudio.com/docs/python/debugging) in VS
Code to learn more about the configurations.

## 5b. pytest in VS Code

In addition to debugging, you can also interactively run pytest. Please
see the VS Code directions to get the [testing framework
setup](https://code.visualstudio.com/docs/python/unit-testing#_enable-a-test-framework).
