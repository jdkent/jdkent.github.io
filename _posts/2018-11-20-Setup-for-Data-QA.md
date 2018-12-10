---
layout: post
author: James Kent
---

# Automating Data Quality Assurance

This is an ongoing process where we are attempting to collect
data and visualize it quickly so we can see if anything looks off.

I still think the best/simplest scenerio is to use psychopy for stimulus
presentation and use other python utilities to generate a figure from
the data.

Alas, we are stuck with eprime and I am struck with inspiration to make things
much more complicated to practice using utilities that are not directly designed for
this use-case.

Before I dive in, here are a list of tools/services/utilities I will be using to
setup the quality assurance service.
They each link to a tutorial/explanation.

- [anaconda](https://conda.io/docs/user-guide/getting-started.html)
- [Docker](https://docs.docker.com/get-started/)
- [circleci](https://circleci.com/docs/2.0/hello-world/)
- [github/github-pages](https://pages.github.com/)
- [jekyll](https://jekyllrb.com/tutorials/video-walkthroughs/)

## Prerequisites

### QA script exists

we've already written/borrowed code to generate an `svg` file from the output of an
eprime task, so I will not be covering that.
We will assume there is a script that generates some form of figure
output (in a [BIDS](https://bids-specification.readthedocs.io/en/latest/)
organized fashion)

### You have a github account

[sign up for github](https://github.com/)

### You have a circleci account

[sign up for circleci](https://circleci.com/) and connect your github account

### You have a dockerhub account

[sign up for dockerhub](https://hub.docker.com/)

## Step 1: Create a reproducible environment to run the QA code

Our QA code for this example is written in python, and currently a good
way to share the environment necessary to run/reproduce the code is anaconda.

If you developed the qa code while working in a conda environment, great!
Otherwise you will create a conda environment with:

```bash
conda create -n eprime_convert python=3.6
```

where `eprime_convert` is the name of the environment (you can make this be
anything you want) and `python=3.6` is selecting the specific version
of python (we currently use `3.6`).
To activate the newly created environment:

```bash
source activate eprime_convert
```

Now you will look at the import statements at the top of your script
and `conda install` the necessary packages.

```python
from convert_eprime import convert
import pandas as pd
import seaborn as sns
from argparse import ArgumentParser
import os
from matplotlib import pyplot as plt
from glob import glob
import shutil
import re
```

From this, it appears I need to install: convert_eprime, pandas, seaborn, and
matplotlib.
All the other imports are from builtin packages in python so they are
available by default.
(you will notice which packages are default with practice)
My first pass to install everything would be:

```bash
conda install convert_eprime pandas seaborn matplotlib
```

This would install everything if I didn't include `convert_eprime`.
`convert_eprime` is not tracked by anaconda, and isn't even tracked by pypi.
It's a [pet project](https://github.com/tsalo/convert-eprime.git) from another
graduate student that was fed up with e-merge.
To install `convert_eprime` I need to know how to install a github repo.
Luckily, [stackoverflow has an answer for everything](https://stackoverflow.com/questions/15268953/how-to-install-python-package-from-github).
So the real commands to install everything are:

```bash
conda install convert_eprime pandas seaborn matplotlib
pip install git+https://github.com/tsalo/convert-eprime.git
```

Test your script to make sure it works with these installs.
If it complains that you are missing something, install it.
Now you can export your environment to a file so it can be reproduced.

```bash
conda env export > environment.yml
```

Open up that environment.yml because we need to edit it.
It may look something like this:

```yml
name: eprime_convert
channels:
  - defaults
dependencies:
  - blas=1.0=mkl
  - ca-certificates=2018.03.07=0
  - certifi=2018.10.15=py36_0
  - cycler=0.10.0=py36_0
  - dbus=1.13.2=h714fa37_1
  - expat=2.2.6=he6710b0_0
  - fontconfig=2.13.0=h9420a91_0
  - freetype=2.9.1=h8a8886c_1
  - glib=2.56.2=hd408876_0
  - gst-plugins-base=1.14.0=hbbd80ab_1
  - gstreamer=1.14.0=hb453b48_1
  - icu=58.2=h9c2bf20_1
  - intel-openmp=2019.0=118
  - jpeg=9b=h024ee3a_2
  - kiwisolver=1.0.1=py36hf484d3e_0
  - libedit=3.1.20170329=h6b74fdf_2
  - libffi=3.2.1=hd88cf55_4
  - libgcc-ng=8.2.0=hdf63c60_1
  - libgfortran-ng=7.3.0=hdf63c60_0
  - libpng=1.6.35=hbc83047_0
  - libstdcxx-ng=8.2.0=hdf63c60_1
  - libuuid=1.0.3=h1bed415_2
  - libxcb=1.13=h1bed415_1
  - libxml2=2.9.8=h26e45fe_1
  - matplotlib=3.0.1=py36h5429711_0
  - mkl=2019.0=118
  - mkl_fft=1.0.6=py36h7dd41cf_0
  - mkl_random=1.0.1=py36h4414c95_1
  - ncurses=6.1=hf484d3e_0
  - numpy=1.15.4=py36h1d66e8a_0
  - numpy-base=1.15.4=py36h81de0dd_0
  - openssl=1.0.2p=h14c3975_0
  - pandas=0.23.4=py36h04863e7_0
  - patsy=0.5.1=py36_0
  - pcre=8.42=h439df22_0
  - pip=18.1=py36_0
  - pyparsing=2.3.0=py36_0
  - pyqt=5.9.2=py36h05f1152_2
  - python=3.6.6=h6e4f718_2
  - python-dateutil=2.7.5=py36_0
  - pytz=2018.7=py36_0
  - qt=5.9.6=h8703b6f_2
  - readline=7.0=h7b6447c_5
  - scipy=1.1.0=py36hfa4b5c9_1
  - seaborn=0.9.0=py36_0
  - setuptools=40.5.0=py36_0
  - sip=4.19.8=py36hf484d3e_0
  - six=1.11.0=py36_1
  - sqlite=3.25.2=h7b6447c_0
  - statsmodels=0.9.0=py36h035aef0_0
  - tk=8.6.8=hbc83047_0
  - tornado=5.1.1=py36h7b6447c_0
  - wheel=0.32.2=py36_0
  - xz=5.2.4=h14c3975_4
  - zlib=1.2.11=ha838bed_2
  - pip:
    - convert-eprime==0.0.1a0
    - future==0.17.1
prefix: /home/james/.conda/envs/eprime_convert
```

If we were only going to run this environment on identical (or near identical)
hardware, then this is fine, but if we want a more flexible `yml`, then we
need to start editing.
A few things to do:

- remove the prefix
- change the convert-eprime version to the github repo
- remove the depency installs and the machine specific install codes

After editing, the file should look something like this:

```yml
name: convert_eprime
channels:
  - defaults
dependencies:
  - matplotlib=3.0.1
  - numpy=1.15.4
  - pandas=0.23.4
  - seaborn=0.9.0
  - python=3.6
  - pip:
    - git+https://github.com/tsalo/convert-eprime.git
```

Much cleaner (I kept numpy as its own install just to be explicit, I don't believe
it's actually necessary to include).

We have created the `yml` to basically build the same environment that we want to
use/build our code with.
This will be good for deploying/sharing the code in multiple contexts.
However, we are going to lock down the environment in which the code runs even further using docker.
Basically, we are going to build a docker container that has our conda environment installed on it.

We can do that by making a Dockerfile that could look like this:

```bash
# https://medium.com/@chadlagore/conda-environments-with-docker-82cdc9d25754
FROM continuumio/miniconda3:4.5.11

COPY eprime_convert.yml /env/

RUN conda env create -f /env/eprime_convert.yml &&\
    conda clean --all

# Pull the environment name out of the environment.yml
RUN echo "source activate $(head -1 /env/eprime_convert.yml | cut -d' ' -f2)" > ~/.bashrc
ENV PATH /opt/conda/envs/$(head -1 /env/eprime_convert.yml | cut -d' ' -f2)/bin:$PATH

ENTRYPOINT [ "/bin/bash", "-c" ]
```

and we can build the Dockerfile with this command:

```bash
docker build -t jdkent/eprime_convert .
```

The tag is linked to my dockerhub account so when I push the container to
dockerhub it will go the correct location.
I will push the container to dockerhub with the following command:

```bash
docker push jdkent/eprime_convert
```

The container can be seen on [dockerhub](https://hub.docker.com/r/jdkent/eprime_convert/).

Excellent!
With this in place we can move on to setting up `circleci`

## Step 2: Use circleci to run the code after each data commit

`circleci` is an online service that can run arbitrary code whenever something
happens in a github repository.
The vagueness of the description hides the power behind this service.
Essentially, your imagination is the limit for what you can do.

[Follow the official circleci docs](https://circleci.com/docs/enterprise/quick-start/)
to add the repository to circleci so that circleci will begin
triggering builds when commits appear in that repository.

Inside your git repository add a `.circleci` folder and make a `config.yml`
inside that folder, that is what circleci will read.

Here is a full example `config.yml` for circleci, I will break it down after.

```yml
# Python CircleCI 2.0 configuration file
#
# Check https://circleci.com/docs/2.0/language-python/ for more details
#
version: 2
jobs:
  build:
    docker:
      # specify the version you desire here
      - image: jdkent/eprime_convert:latest

    working_directory: ~/repo

    steps:
      - run:
          name: clone github repo
          command: |
            git clone https:///${GITHUB_TOKEN}@github.com/HBClab/BetterTaskSwitch.git

      - run:
          name: check if data QA should be skipped
          command: |
            cd ~/repo/BetterTaskSwitch
            if [[ "$( git log --format=oneline -n 1 $CIRCLE_SHA1 | grep -i -E '\[skip[ _]?ci\]' )" != "" ]]; then
              echo "Skipping Data QA"
              circleci step halt
            fi

      - run:
          name: run eprime convert
          command: |
              source activate eprime_convert
              ~/repo/BetterTaskSwitch/code/eprime_convert.py \
                -b ~/repo/BetterTaskSwitch/bids \
                -r ~/repo/BetterTaskSwitch/task-full_resp-srbox \
                -c ~/repo/BetterTaskSwitch/code/config_file/task_switch.json \
                -a mri \
                --sub-prefix GE120
      - run:
          name: add and commit files
          command: |
            cd ~/repo/BetterTaskSwitch
            git config credential.helper 'cache --timeout=120'
            git config user.email "helper@help.com"
            git config user.name "QA Bot"
            # Push quietly to prevent showing the token in log
            git add .
            git commit -m "[skip ci] $(date)"
            git push -q https://${GITHUB_TOKEN}@github.com/HBClab/BetterTaskSwitch.git master
```

- `version: 2`: the overall version of circleci to use, they are depreciating version one so all of them should be version 2
- `jobs:` the list of things I want circleci to run.
  - `build:`: this provides the option to choose what machinary I want circleci to run on
    - `docker:`: I want to use docker to select the environment my jobs are run using.
      - `- image:jdkent/eprime_convert:latest`: this selects the docker image stored on dockerhub that we just made in the last step.
    - `working_directory: ~/repo`: where the commandline interface will drop me when I'm running commands in the docker container we selected (I don't really take advantage of this option).
    - `steps:`: the steps we will take to run the job.
      - `- run:`: instantiation of a step to take in the job
        - `name: clone github repo`: the name of the step we are taking.
        - `command: |`: the actual command we will be running in the docker container (the `|` (pipe) allows us to type the command on a separate line so the line of code does not look crowded).
      - `- run`
        - `name: check if data QA should be skipped`
        - `command: |`: this command checks if `[skip ci]` or `[skip_ci]` is in the most recent commit message and will stop the circleci build if this is selected.
      - `- run:`
        - `name: run eprime convert`
        - `command: |`: this command activates the conda environment and runs our data qa script with the appropriate inputs generating the figure output.
      - `- run:`
        - `name: add and commit files`
        - `command: |`: this command creates a github identity so the bot can push the new data to the github repository (importantly the github message contains `[skip ci]`, what would happen if that wasn't there?)

One important detail I've left out is what's up with `${GITHUB_TOKEN}`.
That is a special variable I've defined using circleci's [environment variable settings](https://circleci.com/docs/2.0/env-vars/#setting-an-environment-variable-in-a-project).
This is great for storing variables that represent some type of authentication (e.g. passwords), but you don't want everyone to be able to see the password.
In this instance I'm using a github token.
You can make your own github token going to your github profile, clicking on settings, clicking on developer settings, and then creating a new token.
[see the github announcement about tokens](https://blog.github.com/2013-05-16-personal-api-tokens/)
**Warning**: you will only have explicit access to your token when you create it, so make sure you copy the token somewhere safe on your computer.

Once you have circleci setup and the config file inside your repository, you are ready to add the files and push the changes back up to github, and observe your first circleci build.
The steps would look something like this:

```bash
git add .circleci/config.yml
git commit -m 'add circleci build configuration'
git push origin master
```

**Note**: the error I ran into when doing this was incorrect permissions of `eprime_convert.py` in my repository.
I gave the file executable permissions with the following command:

```bash
git update-index --chmod=+x eprime_convert.py
```

## Step 3: display the figures using github-pages

We have created a reproducible environment and setup circleci to run everytime
we push a new commit to the repository.
The next step is to easily visualize all the figures we have created.
We will do this using github-pages.

Follow the github instructions to have github start hosting your repository as a static webpage (using github-pages).
I'm using the minimal theme and I suggest that you use that theme too.
Pull the changes to your repository.
You will have an `_config.yml` file in your base directory.
Change the file to look something like this:

```yml
theme: jekyll-theme-minimal
plugins:
  - jekyll-relative-links
title: [BetterTaskSwitch]
description: [Monitoring BetterTaskSwitch Data]
logo: https://avatars0.githubusercontent.com/u/24659915?s=400&u=12a4f626488fe0f692d77f355d9dd9f3e4e63f7a&v=4
baseurl: /BetterTaskSwitch
```

You will change the title, description, and baseurl to what's specific in
the repository you are working on.
The logo is pointing towards our (HBClab) github logo.

Next we will add `liquid` syntax to display all the swarmplots that are in our
repository.
You will place this code in your `README.md` file located at the
base of your repository.

PLEASE IGNORE ALL THE BACKSLASHES!

```liquid
\{\% assign my_files = site.static_files | where:"extname",".svg" | sort:"modified_time" | reverse \%\}

\{\% capture sevendays \%\}\{\{'now' | date: "%s" | minus : 604800 \}\}\{\% endcapture \%\}

\{\% for taskswitch in my_files \%\}
    \{\% if taskswitch.name contains "swarmplot" \%\}
        \{\% capture file_mod \%\}\{\{taskswitch.modified_time | date: "\%s"\}\}\{\% endcapture \%\}
        \{\% if file_mod > sevendays \%\}

### Recent

        \{\% else \%\}

### Older

        \{\% endif \%\}
**\{\{taskswitch.name\}\}**
![\{\{taskswitch.name\}\}](\{\{ taskswitch.path | prepend:site.baseurl \}\})
    \{\% endif \%\}
\{\% endfor \%\}
```

**Note**: [This stackoverflow](https://stackoverflow.com/questions/7087376/comparing-dates-in-liquid)
helped me with how to parse and compare dates

I will explain important bits of this code:

`\{\% assign my_files = site.static_files | where:"extname",".svg" | sort:"modified_time" | reverse \%\}`

This line creates a [variable](https://help.shopify.com/en/themes/liquid/tags/variable-tags)
called my_files that searches through all [static files](https://jekyllrb.com/docs/static-files/)
where the extension of the file is `.svg`.
Next, the resulting array is then piped to [sort the array](https://www.siteleaf.com/blog/advanced-liquid-sort/)
by the date the file was last modified (from oldest -> newest).
Finally, the result is reversed so that the array is sorted from
newest -> oldest.

`\{\% capture sevendays \%\}\{\{'now' | date: "%s" | minus : 604800 \}\}\{\% endcapture \%\}`

This line creates a variable called sevendays which measures the current
time using seconds `%s` and then subtracts seven days worth of
seconds (`7 * 24 * 60 * 60 = 604800`).
This will be used to tell whether an image is seven days old or not.

`\{\% capture file_mod \%\}\{\{taskswitch.modified_time | date: "%s"\}\}\{\% endcapture \%\}`

This line creates the variable file_mod.
file_mod is the date (in seconds) when the file was last modified.
This means we can directly compare file_mod and sevendays to test whether
the file is older or newer than seven days.

`![\{\{taskswitch.name\}\}](\{\{ taskswitch.path | prepend:site.baseurl \}\})`

This is the last line I will explain since it may look confusing.
It combines both markdown syntax and liquid syntax.
Here is the markdown portion: `![name](url)`.
That markdown syntax displays an inline image.
The double curly brackets are liquid syntax.
These return strings that can be interpreted by markdown.
`taskswitch.path` is the path to the file relative to the top
directory of the repository (e.g. `/some/dir/file.svg`).
However, with how github parses the `url`, we also need to
include the website basename as well, so we prepend the site's
baseurl.
If you look back, you can see we defined the baseurl variable in
`_config.yml`.
This is the difference between searching for a file using this
`https://hbclab.github.io` as our baseurl and this
`https://hbclab.github.io/BetterTaskSwitch` (we want this one)


Next we want to check to make sure we did everything correctly.
We can do this by serving the jekyll website we made locally.
Please follow the [github instructions](https://help.github.com/articles/setting-up-your-github-pages-site-locally-with-jekyll/) to do this.

Once we are satisfied with how the website looks, we can add/commit/push
the changes to github.

```bash
git add _config.yml Gemfile README.md
git commit -m 'add website functionality'
git push origin master
```

That's it!
Once you've done all that, you can reap the benefits of having an automated
system that generates figures and makes them visible via a website.
