#!/usr/bin/python
import lxml.html, urllib2, urlparse
import os
import zipfile
import errno
import sys
reload(sys)
from StringIO import StringIO

sys.setdefaultencoding('utf-8')

def get_urls(base_url):
    # fetch the page
    res = urllib2.urlopen(base_url)
    # parse the response into an xml tree
    tree = lxml.html.fromstring(res.read())
    # construct a namespace dictionary to pass to the xpath() call
    # this lets us use regular expressions in the xpath
    ns = {'re': 'http://exslt.org/regular-expressions'}

    # iterate over all <a> tags whose href ends in ".pdf" (case-insensitive)
    for node in tree.xpath('//a[re:test(@href, "\.zip$", "i")]', namespaces=ns):
        # print the href, joining it to the base_url
        yield urlparse.urljoin(base_url, node.attrib['href'])

def mkdir_p(path):
    try:
        os.makedirs(path)
    except OSError as exc: # Python >2.5
        if exc.errno == errno.EEXIST and os.path.isdir(path):
            pass
        else: raise

def extract_zip(i, d):
    print "getting ", i
    zipdata = StringIO(urllib2.urlopen(i).read())
    with zipfile.ZipFile(zipdata) as myzip:
        pop_topdir = False
        for f in myzip.namelist():
            if len(f.split("/")) > 3 and f.split("/")[2] == "cinnamon":
                pop_topdir = True
                break
            # see if you have a directory with @ in the second part
            if len(f.split("/")) > 2  and "@" in f.split("/")[1] \
               and "theme" not in d and "@" not in f.split("/")[0]:
                pop_topdir = True
                break
        for f in myzip.namelist():
            if f in ["2.5", "2.6"]:
                continue
            if ".git" in f:
                continue
            if "Cinnamon1.4/" in f:
                continue
            if "GnomeApplets/Ubuntu Applets/" in f:
                continue
            newf = f
            if "8RTQ-2BI6-ED9J" in i:
                newf = "minty-colors/" + f
            if "PNAL-Q3FF-EUD3" in i:
                newf = "Light-Dark-Balance/" + f
            if "GnomeApplets/Linux Mint Applets/" in f:
                newf = "/".join(f.split("/")[2:])
            if f == "2.6.9":
                newf = "/".join(f.split("/")[1:])
            if "pack" in f.split("/")[0].lower():
                newf = "/".join(f.split("/")[1:])
            if "themes" in f.split("/")[0].lower():
                newf = "/".join(f.split("/")[1:])
            if pop_topdir:
                newf = "/".join(f.split("/")[1:])
            if newf == "" or "~" in newf:
                continue
            with myzip.open(f) as zipf:
                (dpath, fpath) = os.path.split(os.path.join(d, newf))
                if dpath != "":
                    mkdir_p(dpath)
                if dpath == d:
                    continue
                if fpath == "":
                    continue
                print "extracting ", newf
                if fpath[-4:] == ".xml" and \
                       "cinnamon" in d:
                    with open("share/glib-2.0/schemas/" + fpath,
                              "w") as outf:
                        outf.write(zipf.read())
                else:
                    with open(dpath + "/" + fpath, "w") as outf:
                        outf.write(zipf.read())
                    if "tar.gz" in fpath:
                        print "unpacking ", newf
                        os.system("tar xzf " +dpath +"/" + fpath + \
                                      " -C " + d)
                        os.remove(dpath + "/" + fpath)

mkdir_p("share/themes")
for i in get_urls("http://cinnamon-spices.linuxmint.com/uploads/themes/"):
    extract_zip(i, "share/themes")

mkdir_p("share/glib-2.0/schemas")
mkdir_p("share/cinnamon/applets")

for i in get_urls("http://cinnamon-spices.linuxmint.com/uploads/applets/"):
    extract_zip(i, "share/cinnamon/applets")

mkdir_p("share/cinnamon/extensions")
for i in get_urls("http://cinnamon-spices.linuxmint.com/uploads/extensions/"):
    extract_zip(i, "share/cinnamon/extensions")

os.system("tar cJf cinnamon-extras.tar.xz share")

