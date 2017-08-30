#! /usr/bin/python2
# -*- coding=utf-8 -*-

import os
import sys
import tempfile
import shutil
import sqlite3
import json
import urlparse
import subprocess

FAVICON_CACHE_DIR = os.path.join(os.path.split(__file__)[0], "favicon_cache")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        fd, temp_filename = tempfile.mkstemp()
        os.close(fd)
        shutil.copyfile(os.path.join(os.getenv("HOME"), ".config", "chromium", "Default", "History"), temp_filename)

        conn = sqlite3.Connection(temp_filename)
        cur = conn.cursor()

        words = []
        for i in sys.argv[1:]:
            words += i.split()
        query = "SELECT url, title FROM urls WHERE " + " AND ".join(len(words) * ["(url LIKE ? OR title LIKE ?)"]) + " ORDER BY last_visit_time DESC, visit_count DESC LIMIT 10"
        params = []
        for word in words:
            params.append("%" + word + "%")
            params.append("%" + word + "%")
        cur.execute(query, tuple(params))

        results = []
        domains_list = []
        for url, title in cur.fetchall():
            url_parsed = urlparse.urlparse(url)
            domain = url_parsed.scheme + '://' + url_parsed.netloc
            if not domain in domains_list:
                domains_list.append(domain)
            if url and title:
                results.append({
                    "id": url,
                    "url": url,
                    "domain": domain,
                    "description": url,
                    "label": title
                })

        cur.close()
        os.unlink(temp_filename)

        if not os.path.exists(FAVICON_CACHE_DIR):
            os.mkdir(FAVICON_CACHE_DIR)

        fd, temp_filename = tempfile.mkstemp()
        os.close(fd)
        shutil.copyfile(os.path.join(os.getenv("HOME"), ".config", "chromium", "Default", "Favicons"), temp_filename)

        conn = sqlite3.Connection(temp_filename)
        cur = conn.cursor()

        domains_to_favicons = {}
        for domain in domains_list:
            cur.execute("SELECT id, url FROM favicons WHERE url LIKE ?", [domain + "%"])
            for favicon_id, url in cur.fetchall():
                filename = os.path.join(FAVICON_CACHE_DIR, str(favicon_id))
                if not os.path.exists(filename):
                    subprocess.check_call(['wget', '-O', filename, url])
                if os.path.exists(filename):
                    domains_to_favicons[domain] = filename

        cur.close()
        os.unlink(temp_filename)

        for i in range(len(results)):
            if results[i]['domain'] in domains_to_favicons:
                results[i]['icon_filename'] = domains_to_favicons[results[i]['domain']]

        print json.dumps(results)
