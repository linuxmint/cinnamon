#!/usr/bin/python

import sys
import xml.etree.ElementTree as ElementTree
import os.path
import urllib
import subprocess
from os.path import expanduser


class FlickrApi():
    #initing function
    def __init__(self):
        """

        """
        self.path = expanduser("~") + '/.cache/cinnamon/'
        self.api_key = 'e1eb10bf9d9dfe5ceb3f5330c4559e2d'
        self.prefix = 'https://api.flickr.com/services/rest/?api_key=' + self.api_key + "&method="
        self.service = 'flickr'
        if not os.path.exists(self.path + self.service + "/profiles/"):
            os.makedirs(self.path + self.service + "/profiles/")

    def get_user_from_url(self, url):
        """
        Paramaters: Url is the flickr url of user
        Returns dictionary
        user_id
        profile_photo
        user_name
        real_name
         """
        url = self.prefix + "flickr.urls.lookupUser&url=" + urllib.quote_plus(url)
        tree = ElementTree.fromstring(urllib.urlopen(url).read())

        if tree.attrib["stat"] != "ok":
            return None
        return self.get_user_by_id(tree[0].attrib["id"])
        #Get user by his id
    def get_user_by_id(self, user_id):
        url = self.prefix + "flickr.people.getInfo&user_id=" + user_id
        tree = ElementTree.fromstring(urllib.urlopen(url).read())
        if tree.attrib["stat"] != "ok":
            return None
        if tree[0].attrib['iconserver'] != 0:
            profile_photo = "http://farm" + tree[0].attrib["iconfarm"] + ".staticflickr.com/" + tree[0].attrib[
                "iconserver"] + "/buddyicons/" + tree[0].attrib["nsid"] + ".jpg"
        else:
            profile_photo = "https://www.flickr.com/images/buddyicon.gif"
        user = {
            'user_id': tree[0].attrib["id"],
            'profile_photo': profile_photo,
            'user_name': tree[0][0].text,
            'real_name': tree[0][1].text
        }
        return user
    def get_user_photos(self, author_id):
        """
        Based on authors id returns a feed of photos
        """
        url = self.prefix + "flickr.people.getPhotos&user_id=" + author_id + "&extras=url_o&format=rest"
        return self._feed_from_url(url)


    def _feed_from_url(self, url, count=20):
        """
        Based on url returns an array of photos
        """
        result = []
        tree = ElementTree.fromstring(urllib.urlopen(url).read())
        if tree.attrib["stat"] != "ok":
            return None
        counter = 0
        if len(tree[0]) == 0:
            return None
        for photo in tree[0]:
            if 'url_o' in photo.keys():
                result.append(photo.attrib["url_o"])
            else:
                result.append("https://farm"+photo.attrib["farm"]+".staticflickr.com/"+photo.attrib["server"]+"/"+photo.attrib["id"]+"_"+photo.attrib["secret"]+"_b.jpg")
            counter+=1
            
            if counter == count:
                break
        return result

    def get_local_url(self, photo, folder="mix"):
        if photo is None:
            return None
        url = photo
        if url == "":
            return None
        full_path = self.path + self.service + "/" + folder + "/"
        if not os.path.exists(full_path):
            os.makedirs(full_path)
        local_url = full_path + url.split("/")[-1]
        if not (os.path.isfile(local_url)):
            urllib.urlretrieve(url, local_url)
        return local_url

    def store_photos(self, photos, folder="mix"):
        """
        Downloads all the photos
        """
        #Tmp file, after downloading delete
        tmp_file_path = self.path + self.service + "/" + folder + "/.downloading"
        subprocess.Popen(["/usr/bin/touch", tmp_file_path]);
        for photo in photos:
            self.get_local_url(photo, folder)
        os.remove(tmp_file_path)
        

if __name__ == '__main__':
        flickr = FlickrApi()
        # "Parse" args
        # Here is place for add browsing by tags support, etc.
        method = sys.argv[1].replace(" ", "") #can add tags support
        if method == "author":
            user = flickr.get_user_by_id(sys.argv[3])
            if sys.argv[2].replace(" ", "") == "photos":
                flickr.store_photos(flickr.get_user_photos(sys.argv[3]), user["user_name"])
            #elif sys.argv[2].replace(" ", "") == "profile":
            #   print flickr.get_author_profile_photo(sys.argv[3])
