---
title: "Automating Data Quality Assurance"
date: 2018-11-20
permalink: /posts/2018/11/setup-for-data-qa/
tags:
  - automation
  - data-quality
  - reproducibility
---

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
organized fashion).
You can look at the end of the guide for what the code looks like for an example script.

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
conda install pandas seaborn matplotlib
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

{% raw %}
```liquid
{% assign my_files = site.static_files | where:"extname",".svg" | sort:"modified_time" | reverse %}

{% capture sevendays %}{{'now' | date: "%s" | minus : 604800 }}{% endcapture %}

{% for taskswitch in my_files %}
    {% if taskswitch.name contains "swarmplot" %}
        {% capture file_mod %}{{taskswitch.modified_time | date: "%s"}}{% endcapture %}
        {% if file_mod > sevendays %}

### Recent

        {% else %}

### Older

        {% endif %}
**{{taskswitch.name}}**
![{{taskswitch.name}}]({{ taskswitch.path | prepend:site.baseurl }})
    {% endif %}
{% endfor %}
```
{% endraw %}

**Note**: [This stackoverflow](https://stackoverflow.com/questions/7087376/comparing-dates-in-liquid)
helped me with how to parse and compare dates

I will explain important bits of this code:

{% raw %}
`{% assign my_files = site.static_files | where:"extname",".svg" | sort:"modified_time" | reverse %}`
{% endraw %}

This line creates a [variable](https://help.shopify.com/en/themes/liquid/tags/variable-tags)
called my_files that searches through all [static files](https://jekyllrb.com/docs/static-files/)
where the extension of the file is `.svg`.
Next, the resulting array is then piped to [sort the array](https://www.siteleaf.com/blog/advanced-liquid-sort/)
by the date the file was last modified (from oldest -> newest).
Finally, the result is reversed so that the array is sorted from
newest -> oldest.

{% raw %}
`{% capture sevendays %}{{'now' | date: "%s" | minus : 604800 }}{% endcapture %}`
{% endraw %}

This line creates a variable called sevendays which measures the current
time using seconds `%s` and then subtracts seven days worth of
seconds (`7 * 24 * 60 * 60 = 604800`).
This will be used to tell whether an image is seven days old or not.

{% raw %}
`{% capture file_mod %}{{taskswitch.modified_time | date: "%s"}}{% endcapture %}`
{% endraw %}

This line creates the variable file_mod.
file_mod is the date (in seconds) when the file was last modified.
This means we can directly compare file_mod and sevendays to test whether
the file is older or newer than seven days.

{% raw %}
`![{{taskswitch.name}}]({{ taskswitch.path | prepend:site.baseurl }})`
{% endraw %}

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

### Example Script

This code was written to work, not be beautiful, acknowledge that this code may not
represent best (or even) recommended practices.
```
#!/usr/bin/env python
# generate pipelines that read in the eprime txt files and output a
# machine readable summary and a useful figure for quality assurance.

from convert_eprime import convert
import pandas as pd
import numpy as np
from argparse import ArgumentParser
import os
from glob import glob
import shutil
import re
from matplotlib import pyplot as plt
plt.style.use('ggplot')
import seaborn as sns
sns.set_palette("bright")

# expressions
session_dict = {1: 'pre', 2: 'post'}


def get_parser():
    """Build parser object for cmdline processing"""
    parser = ArgumentParser(description='betterVTSM.py: converts '
                                        'eprime output to tsv in BIDS format')
    parser.add_argument('-b', '--bids', action='store',
                        help='root folder of a BIDS valid dataset')
    parser.add_argument('-r', '--raw-dir', action='store',
                        help='directory where edat and txt files live')
    parser.add_argument('-p', '--participant-label', action='store', nargs='+',
                        help='participant label(s) to process')
    parser.add_argument('-s', '--session-label', action='store', nargs='+',
                        help='session label(s) to process (either 1 or 2)')
    parser.add_argument('-c', '--config', action='store', required=True,
                        help='config file to process the eprime txt. '
                             'see convert_eprime for details')
    parser.add_argument('--sub-prefix', action='store',
                        help='add additional characters to the prefix of the participant label')
    return parser

def copy_eprime_files(src, dest):
    # collect edat2 and txt files
    types = ('*.edat2', '*.txt')
    raw_files = []
    for type in types:
        raw_files.extend(glob(os.path.join(src, type)))

    # copy all files into sourcedata (if not already there)
    copied_files = 0
    for file in raw_files:
        out_file = os.path.join(dest, os.path.basename(file))
        if not os.path.isfile(out_file):
            shutil.copy(file, dest)
            copied_files += 1
    return copied_files


def main():
    """Entry point"""
    opts = get_parser().parse_args()

    # set input/output directories
    bids_dir = os.path.abspath(opts.bids)
    # ensure bids directory exists
    os.makedirs(bids_dir, exist_ok=True)



    sourcedata = os.path.join(bids_dir, 'sourcedata', 'VSTM')
    derivatives = os.path.join(bids_dir, 'derivatives')

    # ensure sourcedata and derivatives exist
    os.makedirs(sourcedata, exist_ok=True)
    os.makedirs(derivatives, exist_ok=True)


    # assume data is already copied over if raw_dir isn't specified
    if opts.raw_dir:
        raw_dir = os.path.abspath(opts.raw_dir)
        # output is only the number of copied files, throwing away
        files_copied = copy_eprime_files(raw_dir, sourcedata)
        print('{num} file(s) copied'.format(num=files_copied))
    else:
        print('-r not specified, assuming data are in the correct location: '
              '{dir}'.format(dir=sourcedata))

    # collect participant labels
    if opts.participant_label:
        participants = opts.participant_label
    else:
        participant_files = glob(os.path.join(sourcedata, 'VSTM_*.txt'))
        sub_expr = re.compile(r'^.*VSTM_PACR-(?P<sub_id>[0-9]{3})-(?P<ses_id>[1-2]).txt')
        participants = []
        for participant_file in participant_files:
            print(participant_file)
            sub_dict = sub_expr.search(participant_file).groupdict()
            participants.append(sub_dict['sub_id'])

    # collect sessions
    if opts.session_label:
        sessions = opts.session_label
    else:
        sessions = [1, 2]

    filename_template = 'VSTM_PACR-{sub}-{ses}.{ext}'
    participant_dict = {}
    for participant in participants:
        participant_dict[participant] = {}
        for session in sessions:
            # initialize sub/ses dictionary
            participant_dict[participant][session] = {'edat': None, 'txt': None}

            # get the edat file (if it exists)
            edat_file = filename_template.format(sub=participant,
                                                 ses=session,
                                                 ext='edat2')

            if os.path.isfile(os.path.join(sourcedata, edat_file)):
                participant_dict[participant][session]['edat'] = os.path.join(
                    sourcedata, edat_file
                )
            else:
                print('{edat} missing!'.format(edat=edat_file))
                participant_dict[participant].pop(session)
                continue

            # get the txt file (if it exists)
            txt_file = filename_template.format(sub=participant,
                                                ses=session,
                                                ext='txt')

            if os.path.isfile(os.path.join(sourcedata, txt_file)):
                participant_dict[participant][session]['txt'] = os.path.join(
                    sourcedata, txt_file
                )
            else:
                print('{txt} missing!'.format(txt=txt_file))
                participant_dict[participant].pop(session)
                continue

    # process the data per session
    for participant in participant_dict.keys():
        if opts.sub_prefix:
            participant_label = opts.sub_prefix + participant
        else:
            participant_label = participant
        for session in participant_dict[participant].keys():
            # type coersion to integer
            session = int(session)
            session_label = session_dict[session]
            edat_file = participant_dict[participant][session]['edat']
            txt_file = participant_dict[participant][session]['txt']
            config = os.path.abspath(opts.config)

            folder = 'beh'

            work_file = os.path.join(sourcedata, 'work', 'sub-' + participant_label,
                                     'ses-' + session_label, 'beh',
                                     'sub-{sub}_ses-{ses}_task-VSTM_raw.csv'.format(sub=participant_label, ses=session_label))
            # ensure directory exists
            os.makedirs(os.path.dirname(work_file), exist_ok=True)
            # conversion to csv
            convert.text_to_rcsv(txt_file, edat_file, config, work_file)
            # create dataframe
            df = pd.read_csv(work_file)


            #drops practice trials
            df.drop(df[(df.Running == 'ColorPractice') | (df.Running == 'ShapePractice') | (df.Running == 'PracticeBoth')].index, inplace=True)
            #drop all NaN entries, re: trials where no response was desired (at begining of all VSTM blocks)
            df.dropna(how='all', inplace=True)
            # rename column headers
            df.rename(index=str, columns={"Running": "trial_type",
                              "Probe.ACC": "correct",
                              "Probe.RT": "response_time",
                              "Probe.CRESP": "probe_novelty"}, inplace=True)
            # convert response_time into seconds
            df['response_time'] = df['response_time'] / 1000
            # change 'correct' column from float to int
            df.correct = df.correct.astype(int)
            # create new column for block number
            df['block'] = df['trial_type']
            # replace trial_type elements with simpler description
            df['trial_type'].replace({'SimColour':'color', 'SimShape':'shape',
                                      'SimBoth':'color_and_shape'}, inplace=True)
            # replace probe_novelty elements with a more sensible set
            # {/} -> novel -> 1
            # z -> repeat -> 0
            df['probe_novelty'].replace({'{/}': 1, 'z': 0}, inplace=True)

            # write processed data to file
            base_file = 'sub-{sub}_ses-{ses}_task-VSTM_events.tsv'
            bids_file = os.path.join(bids_dir,
                                     'sub-' + participant_label,
                                     'ses-' + session_label,
                                     folder,
                                     base_file.format(
                                        sub=participant_label,
                                        ses=session_label)
                                     )

            # make sure the directory exists
            os.makedirs(os.path.dirname(bids_file), exist_ok=True)
            df.to_csv(bids_file, sep='\t', index=False)


            # Do some quality assurance
            derivatives_dir = os.path.join(derivatives, 'VSTMQA')
            os.makedirs(derivatives_dir, exist_ok=True)
            base_json = 'sub-{sub}_ses-{ses}_task-VSTM_averages.json'
            out_json = os.path.join(derivatives_dir,
                                    'sub-' + participant_label,
                                    'ses-' + session_label,
                                    folder,
                                    base_json.format(
                                       sub=participant_label,
                                       ses=session_label)
                                    )
            base_fig = 'sub-{sub}_ses-{ses}_task-VSTM_swarmplot.svg'
            out_fig = os.path.join(derivatives_dir,
                                   'sub-' + participant_label,
                                   'ses-' + session_label,
                                   folder,
                                   base_fig.format(
                                    sub=participant_label,
                                    ses=session_label)
                                   )

            # make the derivatives directory for the participant/session in taskSwitchQA
            os.makedirs(os.path.dirname(out_json), exist_ok=True)

            # get average response time and average correct
            json_dict = {'response_time': None, 'correct': None}
            json_dict['response_time'] = df['response_time'].where(df['correct'] == 1).mean()
            json_dict['correct'] = df['correct'].mean()
            ave_res = pd.Series(json_dict)
            ave_res.to_json(out_json)
            if not os.path.isfile(out_fig):
                # make a swarmplot
                myplot = sns.swarmplot(x="trial_type", y="response_time",
                                       hue="correct", data=df, size=6)
                # set the y range larger to fit the legend
                myplot.set_ylim(0, 10.0)
                # remove the title of the legend
                myplot.legend(title=None)
                # rename the xticks
                myplot.set_xticklabels(['Color', 'Shape', 'Shape and Color'])
                # rename xlabel
                myplot.set_xlabel('trial type')
                myplot.set_ylabel('response time (seconds)')
                # rename the legend labels
                new_labels = ['incorrect', 'correct']
                for t, l in zip(myplot.legend_.texts, new_labels):
                    t.set_text(l)
                # save the figure
                myplot.figure.savefig(out_fig, dpi=72)
                # remove all plot features from memory
                plt.clf()


if __name__ == '__main__':
    main()
```
