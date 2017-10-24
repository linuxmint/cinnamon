import os

# creates a directory from a path and ensures that all parent directories also exist
def rec_mkdir(path):
    if os.path.exists(path):
        return

    rec_mkdir(os.path.split(path)[0])

    if os.path.exists(path):
        return
    os.mkdir(path)

def walk_directories(dirs, filter_func, return_directories=False):
    # If return_directories is False: returns a list of valid subdir names
    # Else: returns a list of valid tuples (subdir-names, parent-directory)
    valid = []
    try:
        for thdir in dirs:
            if os.path.isdir(thdir):
                for t in os.listdir(thdir):
                    if filter_func(os.path.join(thdir, t)):
                        if return_directories:
                            valid.append([t, thdir])
                        else:
                            valid.append(t)
    except:
        pass
    return valid

