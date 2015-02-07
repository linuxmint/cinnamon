# -*- coding=utf-8 -*-

import subprocess
import sys
import gettext
import json
from gi.repository import Tracker

gettext.install("cinnamon", "/usr/share/locale")

CONVERT_TYPES = {
    "http://www.tracker-project.org/temp/nmm#MusicPiece": "music",
    "http://www.tracker-project.org/temp/nmm#Video": "videos",
    "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#SoftwareApplication": "software",
    "http://www.tracker-project.org/temp/nmm#Photo": "pictures",
    "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#Folder": "folders",
    "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#FileDataObject": "files"
}

if __name__ == "__main__":
    results = {}
    conn = Tracker.SparqlConnection.get()
    words = sys.argv[1].split(" ");
    query_params = []
    for i in words:
        if i:
            if i[0] == '"' and i[-1] == '"':
                query_params.append("?s fts:match \"" + Tracker.sparql_escape_string(i[1:-1]) + "\"")
            else:
                query_params.append("?s fts:match \"" + Tracker.sparql_escape_string(i) + "*\"")
    query = """SELECT ?s nie:url(?s) nmm:musicAlbum(?s) nmm:performer(?s) nmm:trackNumber(?s) nie:title(?s) nie:mimeType(?s) rdf:type(?s)
                 WHERE { """ + " . ".join(query_params) + """ }
                 ORDER BY DESC (fts:rank(?s))
                 LIMIT 100""";
    cursor = conn.query(query)
    while cursor.next():
        defined_type = None;
        if not cursor.get_string(7)[0] or not cursor.get_string(1)[0]:
            #If we have no defined file type or no file url, skip
            continue
        result_types = cursor.get_string(7)[0].split(",")
        while len(result_types) > 0 and defined_type == None:
            t = result_types.pop()
            if t in CONVERT_TYPES:
                defined_type = CONVERT_TYPES[t]
        if defined_type == None:
            defined_type = "files"
        if len(results.setdefault(defined_type, [])) < 10:
            results.setdefault(defined_type, []).append({
                "id": cursor.get_string(0)[0],
                "url": cursor.get_string(1)[0],
                "musicAlbum": cursor.get_string(2)[0],
                "performer": cursor.get_string(3)[0],
                "trackNumber": cursor.get_string(4)[0],
                "title": cursor.get_string(5)[0],
                "mimeType": cursor.get_string(6)[0],
                "type": defined_type
            });
    final_results = []
    for i in results:
        final_results += results[i]
    print json.dumps(final_results)
