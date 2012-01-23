import os

def load_db():
    tz_db = {}
    
    filename = '/usr/share/zoneinfo/zone.tab'
    if not os.path.exists(filename):
        filename = '/usr/share/lib/zoneinfo/tab/zone_sun.tab'
    if not os.path.exists(filename):
        return {}
        
    tz_file = open(filename)
    
    for line in tz_file:
        line = line.rstrip().lstrip()
        if line=="" or line[0] == '#':
            continue
        
        tz_info = line.split('\t')
        if len(tz_info)<3:
            continue
        tz = tz_info[2].split('/')
        
        region = tz[0]
        zone = tz[1]
        
        if region not in tz_db:
            tz_db[region] = []
        
        tz_db[region].append(zone)
        
    tz_file.close()
    
    return tz_db
