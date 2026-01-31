---
title: "Python User Learning R"
date: 2019-02-05
permalink: /posts/2019/02/python-to-r-part-1/
tags:
  - python
  - r
  - learning
---

Just as I'm getting a feel for python, why not tack on another language.
R is very popular for statistical computing, and the number of packages R has for this functionality confirms that intuition.

So in order to be maximally effective in my graduate work (and use the right model for the job),
I should at least have a passing knowledge of R in addition to python.
I am using this blog format to chronicle my adventures and missteps while learning R.

## WYSIWYG (what you see is what you get)

This is the assumption I've operated under with python.
When I make a list and print out the results, I get something like this:

```python
list(1, 2, 3, 4, 5)
[1, 2, 3, 4, 5]
```

I explicitly see the structure of the list and the straight brackets tell me this is a list as opposed to parens which would indicate a tuple.

However in R, I may get something like:

```R
c(1, 2, 3, 4, 5)
[1] 1 2 3 4 5
```

It took me a little while to get comfortable that the `[1]` prepended is a convenience to show which line the results are being printed out to.
R gets more confusing when trying to show a more complex object.
However, I'm beginning to appreciate R as an interactive programming language, and the seemingly strange way to print data structures is great for the interactive user who does not need to concern themselves with the underlying data structures R is using.

But if you are interested in the structure, then you should use the `struct()` function, which will bring it closer to what I'm used to seeing in python and help me understand the data types I use in R.

The next post will probably be about non-standard evaluation (this still blows my mind)
