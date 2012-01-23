class TzLocation:
	def __init__(self):
		self.code = ''
		self.coords = None
		self.tz = ''
		
	def __str__(self):
		return '(' + str(self.coords) + ', ' + self.tz + ')'
		
	def set_code(self, code):
		self.code = code
		
	def set_coords(self, coordsStr):
		x = 0
		y = 0
	
		xNeg = False
		if coordsStr[0] == '-':
			xNeg = True
			
		coordsStr = coordsStr[1:]
		
		yNeg = '-' in coordsStr
		if yNeg:
			x = int( coordsStr[0 : coordsStr.find('-')] )
			y = int( coordsStr[coordsStr.find('-')+1:] ) * -1
		else:
			x = int( coordsStr[0 : coordsStr.find('+')] )
			y = int( coordsStr[coordsStr.find('+')+1:] )
			
		if xNeg:
			x *= -1
			
		self.coords = (x,y)
		
	def set_tz(self, tz):
		self.tz = tz.replace('\n', '')


tz_db = []

def load_db():
	tz_file = open('/usr/share/zoneinfo/zone.tab')
	
	for line in tz_file:
		if line[0] == '#':
			continue
		
		tz_info = line.split('\t')
		countryCode = tz_info[0]
			
		loc = TzLocation()
		loc.set_code(countryCode)
		loc.set_coords(tz_info[1])
		loc.set_tz(tz_info[2])
		
		tz_db.append(loc)
		
if __name__ == '__main__':
	load_db()
	print len(tz_db)
		
