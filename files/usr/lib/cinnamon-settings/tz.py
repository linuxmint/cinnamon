def load_db():
    tz_db = {}
    
    tz_file = open('/usr/share/zoneinfo/zone.tab')
    
    for line in tz_file:
        if line[0] == '#':
            continue
        line = line.rstrip().lstrip()
        
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
