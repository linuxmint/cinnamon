//This list is taken from https://unicode.org/emoji/charts/emoji-list.html
//Emoji List, v16.0

//Additional keywords are from emojilib (https://github.com/muan/emojilib) License: MIT

const EMOJI = [
// Smileys & Emotion
[
'😀',
'grinning face',
'face grin smile happy joy :D'
],[
'😃',
'grinning face with big eyes',
'face mouth open smile happy joy haha :D :) funny'
],[
'😄',
'grinning face with smiling eyes',
'eye face mouth open smile happy joy funny haha laugh like :D :)'
],[
'😁',
'beaming face with smiling eyes',
'eye face grin smile happy joy kawaii'
],[
'😆',
'grinning squinting face',
'face laugh mouth satisfied smile happy joy lol haha glad XD'
],[
'😅',
'grinning face with sweat',
'cold face open smile sweat hot happy laugh relief'
],[
'🤣',
'rolling on the floor laughing',
'face floor laugh rofl rolling rotfl laughing lol haha'
],[
'😂',
'face with tears of joy',
'face joy laugh tear cry tears weep happy happytears haha'
],[
'🙂',
'slightly smiling face',
'face smile'
],[
'🙃',
'upside-down face',
'face upside-down upside down face flipped silly smile'
],[
'🫠',
'melting face',
'disappear dissolve liquid melt'
],[
'😉',
'winking face',
'face wink happy mischievous secret ;) smile eye'
],[
'😊',
'smiling face with smiling eyes',
'blush eye face smile happy flushed crush embarrassed shy joy'
],[
'😇',
'smiling face with halo',
'angel face fantasy halo innocent heaven'
],[
'🥰',
'smiling face with hearts',
'adore crush hearts in love face love like affection valentines infatuation'
],[
'😍',
'smiling face with heart-eyes',
'eye face love smile smiling face with heart eyes like affection valentines infatuation crush heart'
],[
'🤩',
'star-struck',
'eyes face grinning star starry-eyed star struck smile starry'
],[
'😘',
'face blowing a kiss',
'face kiss love like affection valentines infatuation'
],[
'😗',
'kissing face',
'face kiss love like 3 valentines infatuation'
],[
'☺️',
'smiling face',
'face outlined relaxed smile blush massage happiness'
],[
'😚',
'kissing face with closed eyes',
'closed eye face kiss love like affection valentines infatuation'
],[
'😙',
'kissing face with smiling eyes',
'eye face kiss smile affection valentines infatuation'
],[
'🥲',
'smiling face with tear',
'grateful proud relieved smiling tear touched sad cry pretend'
],[
'😋',
'face savoring food',
'delicious face savouring smile yum happy joy tongue silly yummy nom'
],[
'😛',
'face with tongue',
'face tongue prank childish playful mischievous smile'
],[
'😜',
'winking face with tongue',
'eye face joke tongue wink prank childish playful mischievous smile'
],[
'🤪',
'zany face',
'eye goofy large small face crazy'
],[
'😝',
'squinting face with tongue',
'eye face horrible taste tongue prank playful mischievous smile'
],[
'🤑',
'money-mouth face',
'face money mouth money mouth face rich dollar'
],[
'🤗',
'hugging face',
'face hug hugging smile'
],[
'🤭',
'face with hand over mouth',
'whoops shock sudden realization surprise face'
],[
'🫢',
'face with open eyes and hand over mouth',
'whoops shock sudden realization surprise face'
],[
'🫣',
'face with peeking eye',
'captivated peep stare'
],[
'🤫',
'shushing face',
'quiet shush face shhh'
],[
'🤔',
'thinking face',
'face thinking hmmm think consider'
],[
'🫡',
'saluting face',
'ok salute sunny troops yes'
],[
'🤐',
'zipper-mouth face',
'face mouth zipper zipper mouth face sealed secret'
],[
'🤨',
'face with raised eyebrow',
'distrust skeptic disapproval disbelief mild surprise scepticism face surprise'
],[
'😐',
'neutral face',
'deadpan face meh neutral indifference :|'
],[
'😑',
'expressionless face',
'expressionless face inexpressive meh unexpressive indifferent - - deadpan'
],[
'😶',
'face without mouth',
'face mouth quiet silent hellokitty'
],[
'🫥',
'dotted line face',
'depressed disappear hide introvert invisible'
],[
'😶‍🌫️',
'face in clouds',
'absentminded face in the fog head in clouds'
],[
'😏',
'smirking face',
'face smirk smile mean prank smug sarcasm'
],[
'😒',
'unamused face',
'face unamused unhappy indifference bored straight face serious sarcasm unimpressed skeptical dubious side eye'
],[
'🙄',
'face with rolling eyes',
'eyeroll eyes face rolling frustrated'
],[
'😬',
'grimacing face',
'face grimace teeth'
],[
'😮‍💨',
'face exhaling',
'exhale gasp groan relief whisper whistle'
],[
'🤥',
'lying face',
'face lie pinocchio'
],[
'🫨',
'shaking face',
'earthquake face shaking shock vibrate loud fear double'
],[
'🙂‍↔️',
'head shaking horizontally',
'head shaking horizontally no face'
],[
'🙂‍↕️',
'head shaking vertically',
'head shaking vertically yes nod face agree'
],[
'😌',
'relieved face',
'face relieved relaxed phew massage happiness'
],[
'😔',
'pensive face',
'dejected face pensive sad depressed upset'
],[
'😪',
'sleepy face',
'face sleep tired rest nap'
],[
'🤤',
'drooling face',
'drooling face'
],[
'😴',
'sleeping face',
'bed bedtime face good goodnight nap night sleep sleeping tired whatever yawn zzz'
],[
'🫩',
'face with bags under eyes',
'bags bored exhausted eyes face fatigued late sleepy tired weary'
],[
'😷',
'face with medical mask',
'cold doctor face mask sick ill disease'
],[
'🤒',
'face with thermometer',
'face ill sick thermometer temperature cold fever'
],[
'🤕',
'face with head-bandage',
'bandage face hurt injury face with head bandage injured clumsy'
],[
'🤢',
'nauseated face',
'face nauseated vomit gross green sick throw up ill'
],[
'🤮',
'face vomiting',
'sick vomit face'
],[
'🤧',
'sneezing face',
'face gesundheit sneeze sick allergy'
],[
'🥵',
'hot face',
'feverish heat stroke hot red-faced sweating face heat red'
],[
'🥶',
'cold face',
'blue-faced cold freezing frostbite icicles face blue frozen'
],[
'🥴',
'woozy face',
'dizzy intoxicated tipsy uneven eyes wavy mouth face wavy'
],[
'😵',
'knocked-out face',
'dead face knocked out dizzy face spent unconscious xox dizzy'
],[
'😵‍💫',
'face with spiral eyes',
'dizzy hypnotized spiral trouble whoa'
],[
'🤯',
'exploding head',
'mind blown shocked face mind blown'
],[
'🤠',
'cowboy hat face',
'cowboy cowgirl face hat'
],[
'🥳',
'partying face',
'celebration hat horn party face woohoo'
],[
'🥸',
'disguised face',
'disguise face glasses incognito nose pretent brows moustache'
],[
'😎',
'smiling face with sunglasses',
'bright cool face sun sunglasses smile summer beach sunglass'
],[
'🤓',
'nerd face',
'face geek nerd nerdy dork'
],[
'🧐',
'face with monocle',
'stuffy wealthy face'
],[
'😕',
'confused face',
'confused face meh indifference huh weird hmmm :/'
],[
'🫤',
'face with diagonal mouth',
'disappointed meh skeptical unsure :/'
],[
'😟',
'worried face',
'face worried concern nervous :('
],[
'🙁',
'slightly frowning face',
'face frown frowning disappointed sad upset'
],[
'☹️',
'frowning face',
'face frown sad upset'
],[
'😮',
'face with open mouth',
'face mouth open sympathy surprise impressed wow whoa :O'
],[
'😯',
'hushed face',
'face hushed stunned surprised woo shh'
],[
'😲',
'astonished face',
'astonished face shocked totally xox surprised poisoned'
],[
'😳',
'flushed face',
'dazed face flushed blush shy flattered'
],[
'🥺',
'pleading face',
'begging mercy puppy eyes face'
],[
'🥹',
'face holding back tears',
'angry cry proud resist sad'
],[
'😦',
'frowning face with open mouth',
'face frown mouth open aw what'
],[
'😧',
'anguished face',
'anguished face stunned nervous'
],[
'😨',
'fearful face',
'face fear fearful scared terrified nervous oops huh'
],[
'😰',
'anxious face with sweat',
'blue cold face rushed sweat nervous'
],[
'😥',
'sad but relieved face',
'disappointed face relieved whew phew sweat nervous'
],[
'😢',
'crying face',
'cry face sad tear tears depressed upset'
],[
'😭',
'loudly crying face',
'cry face sad sob tear tears upset depressed'
],[
'😱',
'face screaming in fear',
'face fear munch scared scream omg'
],[
'😖',
'confounded face',
'confounded face confused sick unwell oops :S'
],[
'😣',
'persevering face',
'face persevere sick no upset oops'
],[
'😞',
'disappointed face',
'disappointed face sad upset depressed :('
],[
'😓',
'downcast face with sweat',
'cold face sweat hot sad tired exercise'
],[
'😩',
'weary face',
'face tired weary sleepy sad frustrated upset'
],[
'😫',
'tired face',
'face tired sick whine upset frustrated'
],[
'🥱',
'yawning face',
'bored tired yawn sleepy'
],[
'😤',
'face with steam from nose',
'face triumph won gas phew proud pride'
],[
'😡',
'enraged face',
'angry enraged face mad pouting rage red hate despise'
],[
'😠',
'angry face',
'angry face mad annoyed frustrated'
],[
'🤬',
'face with symbols on mouth',
'swearing cursing face cussing profanity expletive'
],[
'😈',
'smiling face with horns',
'face fairy tale fantasy horns smile devil'
],[
'👿',
'angry face with horns',
'demon devil face fantasy imp angry horns'
],[
'💀',
'skull',
'death face fairy tale monster dead skeleton creepy'
],[
'☠️',
'skull and crossbones',
'crossbones death face monster skull poison danger deadly scary pirate evil'
],[
'💩',
'pile of poo',
'dung face monster poo poop hankey shitface fail turd shit'
],[
'🤡',
'clown face',
'clown face'
],[
'👹',
'ogre',
'creature face fairy tale fantasy monster troll red mask halloween scary creepy devil demon japanese'
],[
'👺',
'goblin',
'creature face fairy tale fantasy monster red evil mask scary creepy japanese'
],[
'👻',
'ghost',
'creature face fairy tale fantasy monster halloween spooky scary'
],[
'👽',
'alien',
'creature extraterrestrial face fantasy ufo UFO paul weird outer space'
],[
'👾',
'alien monster',
'alien creature extraterrestrial face monster ufo game arcade play'
],[
'🤖',
'robot',
'face monster computer machine bot'
],[
'😺',
'grinning cat',
'cat face grinning mouth open smile animal cats happy'
],[
'😸',
'grinning cat with smiling eyes',
'cat eye face grin smile animal cats'
],[
'😹',
'cat with tears of joy',
'cat face joy tear animal cats haha happy tears'
],[
'😻',
'smiling cat with heart-eyes',
'cat eye face heart love smile smiling cat with heart eyes animal like affection cats valentines'
],[
'😼',
'cat with wry smile',
'cat face ironic smile wry animal cats smirk'
],[
'😽',
'kissing cat',
'cat eye face kiss animal cats'
],[
'🙀',
'weary cat',
'cat face oh surprised weary animal cats munch scared scream'
],[
'😿',
'crying cat',
'cat cry face sad tear animal tears weep cats upset'
],[
'😾',
'pouting cat',
'cat face pouting animal cats'
],[
'🙈',
'see-no-evil monkey',
'evil face forbidden monkey see see no evil monkey animal nature haha'
],[
'🙉',
'hear-no-evil monkey',
'evil face forbidden hear monkey hear no evil monkey animal nature'
],[
'🙊',
'speak-no-evil monkey',
'evil face forbidden monkey speak speak no evil monkey animal nature omg'
],[
'💌',
'love letter',
'heart letter love mail email like affection envelope valentines'
],[
'💘',
'heart with arrow',
'arrow cupid love like heart affection valentines'
],[
'💝',
'heart with ribbon',
'ribbon valentine love valentines'
],[
'💖',
'sparkling heart',
'excited sparkle love like affection valentines'
],[
'💗',
'growing heart',
'excited growing nervous pulse like love affection valentines pink'
],[
'💓',
'beating heart',
'beating heartbeat pulsating love like affection valentines pink heart'
],[
'💞',
'revolving hearts',
'revolving love like affection valentines'
],[
'💕',
'two hearts',
'love like affection valentines heart'
],[
'💟',
'heart decoration',
'heart purple-square love like'
],[
'❣️',
'heart exclamation',
'exclamation mark punctuation decoration love'
],[
'💔',
'broken heart',
'break broken sad sorry heart heartbreak'
],[
'❤️‍🔥',
'heart on fire',
'burn love lust sacred heart'
],[
'❤️‍🩹',
'mending heart',
'healthier improving mending recovering recuperating well'
],[
'❤️',
'red heart',
'heart love like valentines'
],[
'🩷',
'pink heart',
'cute heart like love pink friendship affection valentines'
],[
'🧡',
'orange heart',
'orange love like affection valentines'
],[
'💛',
'yellow heart',
'yellow love like affection valentines'
],[
'💚',
'green heart',
'green love like affection valentines'
],[
'💙',
'blue heart',
'blue love like affection valentines'
],[
'🩵',
'light blue heart',
'cyan heart light blue teal love like affection valentines'
],[
'💜',
'purple heart',
'purple love like affection valentines'
],[
'🤎',
'brown heart',
'brown heart coffee love like'
],[
'🖤',
'black heart',
'black evil wicked love like'
],[
'🩶',
'grey heart',
'grey heart silver slate love like affection valentines'
],[
'🤍',
'white heart',
'heart white pure love like'
],[
'💋',
'kiss mark',
'kiss lips face love like affection valentines'
],[
'💯',
'hundred points',
'100 full hundred score perfect numbers century exam quiz test pass'
],[
'💢',
'anger symbol',
'angry comic mad'
],[
'💥',
'collision',
'boom comic bomb explode explosion blown'
],[
'💫',
'dizzy',
'comic star sparkle shoot magic'
],[
'💦',
'sweat droplets',
'comic splashing sweat water drip oops'
],[
'💨',
'dashing away',
'comic dash running wind air fast shoo fart smoke puff'
],[
'🕳️',
'hole',
'embarrassing'
],[
'💬',
'speech balloon',
'balloon bubble comic dialog speech words message talk chatting'
],[
'👁️‍🗨️',
'eye in speech bubble',
'eye speech bubble witness info'
],[
'🗨️',
'left speech bubble',
'dialog speech words message talk chatting'
],[
'🗯️',
'right anger bubble',
'angry balloon bubble mad caption speech thinking'
],[
'💭',
'thought balloon',
'balloon bubble comic thought cloud speech thinking dream'
],[
'💤',
'zzz',
'comic sleep sleepy tired dream'
],



// People & Body
[
'👋',
'waving hand',
'hand wave waving hands gesture goodbye solong farewell hello hi palm'
],[
'🤚',
'raised back of hand',
'backhand raised fingers'
],[
'🖐',
'hand with fingers splayed',
'finger hand splayed fingers palm'
],[
'✋',
'raised hand',
'hand high 5 high five fingers stop highfive palm ban'
],[
'🖖',
'vulcan salute',
'finger hand spock vulcan fingers star trek'
],[
'🫱',
'rightwards hand',
'right'
],[
'🫲',
'leftwards hand',
'left'
],[
'🫳',
'palm down hand',
'dismiss drop shoo'
],[
'🫴',
'palm up hand',
'beckon catch come offer'
],[
'🫷',
'leftwards pushing hand',
'high five leftward pushing hand refuse reject stop wait palm'
],[
'🫸',
'rightwards pushing hand',
'high five rightward pushing hand refuse reject stop wait palm'
],[
'👌',
'OK hand',
'hand OK ok hand fingers limbs perfect ok okay'
],[
'🤌',
'pinched fingers',
'fingers hand gesture interrogation pinched sarcastic size tiny small'
],[
'🤏',
'pinching hand',
'small amount tiny small size'
],[
'✌',
'victory hand',
'hand v victory fingers ohyeah peace two'
],[
'🤞',
'crossed fingers',
'cross finger hand luck good lucky'
],[
'🫰',
'hand with index finger and thumb crossed',
'expensive heart love money snap cash'
],[
'🤟',
'love-you gesture',
'hand ILY love you gesture fingers gesture'
],[
'🤘',
'sign of the horns',
'finger hand horns rock-on fingers evil eye sign of horns rock on'
],[
'🤙',
'call me hand',
'call hand hands gesture'
],[
'👈',
'backhand index pointing left',
'backhand finger hand index point direction fingers left'
],[
'👉',
'backhand index pointing right',
'backhand finger hand index point fingers direction right'
],[
'👆',
'backhand index pointing up',
'backhand finger hand point up fingers direction'
],[
'🖕',
'middle finger',
'finger hand fingers rude middle flipping'
],[
'👇',
'backhand index pointing down',
'backhand down finger hand point fingers direction'
],[
'☝',
'index pointing up',
'finger hand index point up fingers direction'
],[
'🫵',
'index pointing at the viewer',
'finger index point you'
],[
'👍',
'thumbs up',
'+1 hand thumb up thumbsup yes awesome good agree accept cool like'
],[
'👎',
'thumbs down',
'-1 down hand thumb thumbsdown no dislike'
],[
'✊',
'raised fist',
'clenched fist hand punch fingers grasp'
],[
'👊',
'oncoming fist',
'clenched fist hand punch angry violence hit attack'
],[
'🤛',
'left-facing fist',
'fist leftwards left facing fist hand fistbump'
],[
'🤜',
'right-facing fist',
'fist rightwards right facing fist hand fistbump'
],[
'👏',
'clapping hands',
'clap hand hands praise applause congrats yay'
],[
'🙌',
'raising hands',
'celebration gesture hand hooray raised yea hands'
],[
'🫶',
'heart hands',
'love'
],[
'👐',
'open hands',
'hand open fingers butterfly hands'
],[
'🤲',
'palms up together',
'prayer cupped hands hands gesture cupped'
],[
'🤝',
'handshake',
'agreement hand meeting shake'
],[
'🙏',
'folded hands',
'ask hand high 5 high five please pray thanks hope wish namaste highfive'
],[
'✍',
'writing hand',
'hand write lower left ballpoint pen stationery compose'
],[
'💅',
'nail polish',
'care cosmetics manicure nail polish beauty finger fashion'
],[
'🤳',
'selfie',
'camera phone'
],[
'💪',
'flexed biceps',
'biceps comic flex muscle arm hand summer strong'
],[
'🦾',
'mechanical arm',
'accessibility prosthetic'
],[
'🦿',
'mechanical leg',
'accessibility prosthetic'
],[
'🦵',
'leg',
'kick limb'
],[
'🦶',
'foot',
'kick stomp'
],[
'👂',
'ear',
'body face hear sound listen'
],[
'🦻',
'ear with hearing aid',
'accessibility hard of hearing'
],[
'👃',
'nose',
'body smell sniff'
],[
'🧠',
'brain',
'intelligent smart'
],[
'🫀',
'anatomical heart',
'anatomical cardiology heart organ pulse health heartbeat'
],[
'🫁',
'lungs',
'breath exhalation inhalation organ respiration breathe'
],[
'🦷',
'tooth',
'dentist teeth'
],[
'🦴',
'bone',
'skeleton'
],[
'👀',
'eyes',
'eye face look watch stalk peek see'
],[
'👁️',
'eye',
'body face look see watch stare'
],[
'👅',
'tongue',
'body mouth playful'
],[
'👄',
'mouth',
'lips kiss'
],[
'🫦',
'biting lip',
'anxious fear flirting nervous uncomfortable worried sexy'
],[
'👶',
'baby',
'young child boy girl toddler'
],[
'🧒',
'child',
'gender-neutral unspecified gender young'
],[
'👦',
'boy',
'young man male guy teenager'
],[
'👧',
'girl',
'Virgo young zodiac female woman teenager'
],[
'🧑',
'person',
'adult gender-neutral unspecified gender'
],[
'👱',
'person: blond hair',
'blond blond-haired person hair person blond hair hairstyle'
],[
'👨',
'man',
'adult mustache father dad guy classy sir moustache'
],[
'🧔',
'person: beard',
'beard person bewhiskered man beard'
],[
'🧔‍♂️',
'man: beard',
'beard man'
],[
'🧔‍♀️',
'woman: beard',
'beard woman'
],[
'👨‍🦰',
'man: red hair',
'adult man red hair man red hair hairstyle'
],[
'👨‍🦱',
'man: curly hair',
'adult curly hair man man curly hair hairstyle'
],[
'👨‍🦳',
'man: white hair',
'adult man white hair man white hair old elder'
],[
'👨‍🦲',
'man: bald',
'adult bald man man bald hairless'
],[
'👩',
'woman',
'adult female girls lady'
],[
'👩‍🦰',
'woman: red hair',
'adult red hair woman woman red hair hairstyle'
],[
'🧑‍🦰',
'person: red hair',
'adult gender-neutral person red hair unspecified gender person red hair hairstyle'
],[
'👩‍🦱',
'woman: curly hair',
'adult curly hair woman woman curly hair hairstyle'
],[
'🧑‍🦱',
'person: curly hair',
'adult curly hair gender-neutral person unspecified gender person curly hair hairstyle'
],[
'👩‍🦳',
'woman: white hair',
'adult white hair woman woman white hair old elder'
],[
'🧑‍🦳',
'person: white hair',
'adult gender-neutral person unspecified gender white hair person white hair elder old'
],[
'👩‍🦲',
'woman: bald',
'adult bald woman woman bald hairless'
],[
'🧑‍🦲',
'person: bald',
'adult bald gender-neutral person unspecified gender person bald hairless'
],[
'👱‍♀️',
'woman: blond hair',
'blond-haired woman blonde hair woman woman blond hair female girl person'
],[
'👱‍♂️',
'man: blond hair',
'blond blond-haired man hair man man blond hair male boy blonde guy person'
],[
'🧓',
'older person',
'adult gender-neutral old unspecified gender human elder senior'
],[
'👴',
'old man',
'adult man old human male men elder senior'
],[
'👵',
'old woman',
'adult old woman human female women lady elder senior'
],[
'🙍',
'person frowning',
'frown gesture worried'
],[
'🙍‍♂️',
'man frowning',
'frowning gesture man male boy sad depressed discouraged unhappy'
],[
'🙍‍♀️',
'woman frowning',
'frowning gesture woman female girl sad depressed discouraged unhappy'
],[
'🙎',
'person pouting',
'gesture pouting upset'
],[
'🙎‍♂️',
'man pouting',
'gesture man pouting male boy'
],[
'🙎‍♀️',
'woman pouting',
'gesture pouting woman female girl'
],[
'🙅',
'person gesturing NO',
'forbidden gesture hand prohibited person gesturing no decline'
],[
'🙅‍♂️',
'man gesturing NO',
'forbidden gesture hand man prohibited man gesturing no male boy nope'
],[
'🙅‍♀️',
'woman gesturing NO',
'forbidden gesture hand prohibited woman woman gesturing no female girl nope'
],[
'🙆',
'person gesturing OK',
'gesture hand OK person gesturing ok agree'
],[
'🙆‍♂️',
'man gesturing OK',
'gesture hand man OK man gesturing ok men boy male blue human'
],[
'🙆‍♀️',
'woman gesturing OK',
'gesture hand OK woman woman gesturing ok women girl female pink human'
],[
'💁',
'person tipping hand',
'hand help information sassy tipping'
],[
'💁‍♂️',
'man tipping hand',
'man sassy tipping hand male boy human information'
],[
'💁‍♀️',
'woman tipping hand',
'sassy tipping hand woman female girl human information'
],[
'🙋',
'person raising hand',
'gesture hand happy raised question'
],[
'🙋‍♂️',
'man raising hand',
'gesture man raising hand male boy'
],[
'🙋‍♀️',
'woman raising hand',
'gesture raising hand woman female girl'
],[
'🧏',
'deaf person',
'accessibility deaf ear hear'
],[
'🧏‍♂️',
'deaf man',
'deaf man accessibility'
],[
'🧏‍♀️',
'deaf woman',
'deaf woman accessibility'
],[
'🙇',
'person bowing',
'apology bow gesture sorry respectiful'
],[
'🙇‍♂️',
'man bowing',
'apology bowing favor gesture man sorry male boy'
],[
'🙇‍♀️',
'woman bowing',
'apology bowing favor gesture sorry woman female girl'
],[
'🤦',
'person facepalming',
'disbelief exasperation face palm facepalm disappointed slap hand forehead'
],[
'🤦‍♂️',
'man facepalming',
'disbelief exasperation face palm facepalm disappointed slap hand forehead man male boy'
],[
'🤦‍♀️',
'woman facepalming',
'disbelief exasperation face palm facepalm disappointed slap hand forehead woman female girl'
],[
'🤷',
'person shrugging',
'doubt ignorance indifference shrug regardless'
],[
'🤷‍♂️',
'man shrugging',
'doubt ignorance indifference man shrug male boy confused indifferent'
],[
'🤷‍♀️',
'woman shrugging',
'doubt ignorance indifference shrug woman female girl confused indifferent'
],[
'🧑‍⚕️',
'health worker',
'doctor healthcare nurse therapist hospital'
],[
'👨‍⚕️',
'man health worker',
'doctor healthcare man nurse therapist human'
],[
'👩‍⚕️',
'woman health worker',
'doctor healthcare nurse therapist woman human'
],[
'🧑‍🎓',
'student',
'graduate learn'
],[
'👨‍🎓',
'man student',
'graduate man student human'
],[
'👩‍🎓',
'woman student',
'graduate student woman human'
],[
'🧑‍🏫',
'teacher',
'instructor professor'
],[
'👨‍🏫',
'man teacher',
'instructor man professor teacher human'
],[
'👩‍🏫',
'woman teacher',
'instructor professor teacher woman human'
],[
'🧑‍⚖️',
'judge',
'justice scales law'
],[
'👨‍⚖️',
'man judge',
'judge justice man scales court human'
],[
'👩‍⚖️',
'woman judge',
'judge justice scales woman court human'
],[
'🧑‍🌾',
'farmer',
'gardener rancher crops'
],[
'👨‍🌾',
'man farmer',
'farmer gardener man rancher human'
],[
'👩‍🌾',
'woman farmer',
'farmer gardener rancher woman human'
],[
'🧑‍🍳',
'cook',
'chef food kitchen culinary'
],[
'👨‍🍳',
'man cook',
'chef cook man human'
],[
'👩‍🍳',
'woman cook',
'chef cook woman human'
],[
'🧑‍🔧',
'mechanic',
'electrician plumber tradesperson worker technician'
],[
'👨‍🔧',
'man mechanic',
'electrician man mechanic plumber tradesperson human wrench'
],[
'👩‍🔧',
'woman mechanic',
'electrician mechanic plumber tradesperson woman human wrench'
],[
'🧑‍🏭',
'factory worker',
'assembly factory industrial worker labor'
],[
'👨‍🏭',
'man factory worker',
'assembly factory industrial man worker human'
],[
'👩‍🏭',
'woman factory worker',
'assembly factory industrial woman worker human'
],[
'🧑‍💼',
'office worker',
'architect business manager white-collar'
],[
'👨‍💼',
'man office worker',
'architect business man manager white-collar human'
],[
'👩‍💼',
'woman office worker',
'architect business manager white-collar woman human'
],[
'🧑‍🔬',
'scientist',
'biologist chemist engineer physicist chemistry'
],[
'👨‍🔬',
'man scientist',
'biologist chemist engineer man physicist scientist human'
],[
'👩‍🔬',
'woman scientist',
'biologist chemist engineer physicist scientist woman human'
],[
'🧑‍💻',
'technologist',
'coder developer inventor software computer'
],[
'👨‍💻',
'man technologist',
'coder developer inventor man software technologist engineer programmer human laptop computer'
],[
'👩‍💻',
'woman technologist',
'coder developer inventor software technologist woman engineer programmer human laptop computer'
],[
'🧑‍🎤',
'singer',
'actor entertainer rock star song artist performer'
],[
'👨‍🎤',
'man singer',
'actor entertainer man rock singer star rockstar human'
],[
'👩‍🎤',
'woman singer',
'actor entertainer rock singer star woman rockstar human'
],[
'🧑‍🎨',
'artist',
'palette painting draw creativity'
],[
'👨‍🎨',
'man artist',
'artist man palette painter human'
],[
'👩‍🎨',
'woman artist',
'artist palette woman painter human'
],[
'🧑‍✈️',
'pilot',
'plane fly airplane'
],[
'👨‍✈️',
'man pilot',
'man pilot plane aviator human'
],[
'👩‍✈️',
'woman pilot',
'pilot plane woman aviator human'
],[
'🧑‍🚀',
'astronaut',
'rocket outerspace'
],[
'👨‍🚀',
'man astronaut',
'astronaut man rocket space human'
],[
'👩‍🚀',
'woman astronaut',
'astronaut rocket woman space human'
],[
'🧑‍🚒',
'firefighter',
'firetruck fire'
],[
'👨‍🚒',
'man firefighter',
'firefighter firetruck man fireman human'
],[
'👩‍🚒',
'woman firefighter',
'firefighter firetruck woman fireman human'
],[
'👮',
'police officer',
'cop officer police'
],[
'👮‍♂️',
'man police officer',
'cop man officer police law legal enforcement arrest 911'
],[
'👮‍♀️',
'woman police officer',
'cop officer police woman law legal enforcement arrest 911 female'
],[
'🕵',
'detective',
'sleuth spy human'
],[
'🕵️‍♂️',
'man detective',
'detective man sleuth spy crime'
],[
'🕵️‍♀️',
'woman detective',
'detective sleuth spy woman human female'
],[
'💂',
'guard',
'protect'
],[
'💂‍♂️',
'man guard',
'guard man uk gb british male guy royal'
],[
'💂‍♀️',
'woman guard',
'guard woman uk gb british female royal'
],[
'🥷',
'ninja',
'fighter hidden stealth ninjutsu skills japanese'
],[
'👷',
'construction worker',
'construction hat worker labor build'
],[
'👷‍♂️',
'man construction worker',
'construction man worker male human wip guy build labor'
],[
'👷‍♀️',
'woman construction worker',
'construction woman worker female human wip build labor'
],[
'🫅',
'person with crown',
'monarch noble regal royalty king queen'
],[
'🤴',
'prince',
'boy man male crown royal king'
],[
'👸',
'princess',
'fairy tale fantasy girl woman female blond crown royal queen'
],[
'👳',
'person wearing turban',
'turban headdress'
],[
'👳‍♂️',
'man wearing turban',
'man turban male indian hinduism arabs'
],[
'👳‍♀️',
'woman wearing turban',
'turban woman female indian hinduism arabs'
],[
'👲',
'person with skullcap',
'cap gua pi mao hat person skullcap man with skullcap male boy chinese'
],[
'🧕',
'woman with headscarf',
'headscarf hijab mantilla tichel bandana head kerchief female'
],[
'🤵',
'person in tuxedo',
'groom person tuxedo man in tuxedo couple marriage wedding'
],[
'🤵‍♂️',
'man in tuxedo',
'man tuxedo formal fashion'
],[
'🤵‍♀️',
'woman in tuxedo',
'tuxedo woman formal fashion'
],[
'👰',
'person with veil',
'bride person veil wedding bride with veil couple marriage woman'
],[
'👰‍♂️',
'man with veil',
'man veil wedding marriage'
],[
'👰‍♀️',
'woman with veil',
'veil woman wedding marriage'
],[
'🤰',
'pregnant woman',
'belly full pregnant woman baby'
],[
'🫃',
'pregnant man',
'belly full pregnant'
],[
'🫄',
'pregnant person',
'belly full pregnant'
],[
'🤱',
'breast-feeding',
'baby breast nursing breast feeding'
],[
'👩‍🍼',
'woman feeding baby',
'baby feeding nursing woman birth food'
],[
'👨‍🍼',
'man feeding baby',
'baby feeding man nursing birth food'
],[
'🧑‍🍼',
'person feeding baby',
'baby feeding nursing person birth food'
],[
'👼',
'baby angel',
'angel baby face fairy tale fantasy heaven wings halo'
],[
'🎅',
'Santa Claus',
'celebration Christmas claus father santa santa claus festival man male xmas father christmas'
],[
'🤶',
'Mrs. Claus',
'celebration Christmas claus mother Mrs. mrs claus woman female xmas mother christmas'
],[
'🧑‍🎄',
'mx claus',
'Claus, christmas christmas'
],[
'🦸',
'superhero',
'good hero heroine superpower marvel'
],[
'🦸‍♂️',
'man superhero',
'good hero man superpower male superpowers'
],[
'🦸‍♀️',
'woman superhero',
'good hero heroine superpower woman female superpowers'
],[
'🦹',
'supervillain',
'criminal evil superpower villain marvel'
],[
'🦹‍♂️',
'man supervillain',
'criminal evil man superpower villain male bad hero superpowers'
],[
'🦹‍♀️',
'woman supervillain',
'criminal evil superpower villain woman female bad heroine superpowers'
],[
'🧙',
'mage',
'sorcerer sorceress witch wizard magic'
],[
'🧙‍♂️',
'man mage',
'sorcerer wizard man male mage'
],[
'🧙‍♀️',
'woman mage',
'sorceress witch woman female mage'
],[
'🧚',
'fairy',
'Oberon Puck Titania wings magical'
],[
'🧚‍♂️',
'man fairy',
'Oberon Puck man male'
],[
'🧚‍♀️',
'woman fairy',
'Titania woman female'
],[
'🧛',
'vampire',
'Dracula undead blood twilight'
],[
'🧛‍♂️',
'man vampire',
'Dracula undead man male dracula'
],[
'🧛‍♀️',
'woman vampire',
'undead woman female'
],[
'🧜',
'merperson',
'mermaid merman merwoman sea'
],[
'🧜‍♂️',
'merman',
'Triton man male triton'
],[
'🧜‍♀️',
'mermaid',
'merwoman woman female ariel'
],[
'🧝',
'elf',
'magical LOTR style'
],[
'🧝‍♂️',
'man elf',
'magical man male'
],[
'🧝‍♀️',
'woman elf',
'magical woman female'
],[
'🧞',
'genie',
'djinn (non-human color) magical wishes'
],[
'🧞‍♂️',
'man genie',
'djinn man male'
],[
'🧞‍♀️',
'woman genie',
'djinn woman female'
],[
'🧟',
'zombie',
'undead walking dead (non-human color) dead'
],[
'🧟‍♂️',
'man zombie',
'undead walking dead man male dracula'
],[
'🧟‍♀️',
'woman zombie',
'undead walking dead woman female'
],[
'🧌',
'troll',
'fairy tale fantasy monster ogre'
],[
'💆',
'person getting massage',
'face massage salon relax'
],[
'💆‍♂️',
'man getting massage',
'face man massage male boy head'
],[
'💆‍♀️',
'woman getting massage',
'face massage woman female girl head'
],[
'💇',
'person getting haircut',
'barber beauty haircut parlor hairstyle'
],[
'💇‍♂️',
'man getting haircut',
'haircut man male boy'
],[
'💇‍♀️',
'woman getting haircut',
'haircut woman female girl'
],[
'🚶',
'person walking',
'hike walking move human feet steps'
],[
'🚶‍♂️',
'man walking',
'hike man walking move human feet steps'
],[
'🚶‍♀️',
'woman walking',
'hike walking woman move human feet steps female'
],[
'🚶‍➡️',
'person walking facing right',
'hike man walking move human feet steps'
],[
'🚶‍♂️‍➡️',
'man walking facing right',
'hike man walking move human feet steps'
],[
'🚶‍♀️‍➡️',
'woman walking facing right',
'hike walking woman move human feet steps female'
],[
'🧍',
'person standing',
'stand standing still'
],[
'🧍‍♂️',
'man standing',
'man standing still'
],[
'🧍‍♀️',
'woman standing',
'standing woman still'
],[
'🧎',
'person kneeling',
'person kneeling pray respectful'
],[
'🧎‍♂️',
'man kneeling',
'kneeling man pray respectful'
],[
'🧎‍♀️',
'woman kneeling',
'kneeling woman respectful pray'
],[
'🧎‍➡️',
'person kneeling facing right',
'person kneeling pray respectful'
],[
'🧎‍♀️‍➡️',
'woman kneeling facing right',
'kneeling woman respectful pray'
],[
'🧎‍♂️‍➡️',
'man kneeling facing right',
'kneeling man pray respectful'
],[
'🧑‍🦯',
'person with white cane',
'accessibility blind person with probing cane'
],[
'🧑‍🦯‍➡️',
'person with white cane facing right',
'accessibility blind person with probing cane'
],[
'👨‍🦯',
'man with white cane',
'accessibility blind man with probing cane'
],[
'👨‍🦯‍➡️',
'man with white cane facing right',
'accessibility blind man with probing cane'
],[
'👩‍🦯',
'woman with white cane',
'accessibility blind woman with probing cane'
],[
'👩‍🦯‍➡️',
'woman with white cane facing right',
'accessibility blind woman with probing cane'
],[
'🧑‍🦼',
'person in motorized wheelchair',
'accessibility wheelchair disability'
],[
'🧑‍🦼‍➡️',
'person in motorized wheelchair facing right',
'accessibility wheelchair disability'
],[
'👨‍🦼',
'man in motorized wheelchair',
'accessibility man wheelchair disability'
],[
'👨‍🦼‍➡️',
'man in motorized wheelchair facing right',
'accessibility man wheelchair disability'
],[
'👩‍🦼',
'woman in motorized wheelchair',
'accessibility wheelchair woman disability'
],[
'👩‍🦼‍➡️',
'woman in motorized wheelchair facing right',
'accessibility wheelchair woman disability'
],[
'🧑‍🦽',
'person in manual wheelchair',
'accessibility wheelchair disability'
],[
'🧑‍🦽‍➡️',
'person in manual wheelchair facing right',
'accessibility wheelchair disability'
],[
'👨‍🦽',
'man in manual wheelchair',
'accessibility man wheelchair disability'
],[
'👨‍🦽‍➡️',
'man in manual wheelchair facing right',
'accessibility man wheelchair disability'
],[
'👩‍🦽',
'woman in manual wheelchair',
'accessibility wheelchair woman disability'
],[
'👩‍🦽‍➡️',
'woman in manual wheelchair facing right',
'accessibility wheelchair woman disability'
],[
'🏃',
'person running',
'marathon racing running sprint move fast exercise race'
],[
'🏃‍♂️',
'man running',
'man marathon racing running sprint move fast exercise race male'
],[
'🏃‍♀️',
'woman running',
'marathon racing running sprint woman move fast exercise race female'
],[
'🏃‍➡️',
'person running facing right',
'marathon running sprint move fast exercise race'
],[
'🏃‍♀️‍➡️',
'woman running facing right',
'marathon racing running sprint woman move fast exercise race female'
],[
'🏃‍♂️‍➡️',
'man running facing right',
'man marathon racing running sprint move fast exercise race male'
],[
'💃',
'woman dancing',
'dance dancing woman female girl fun'
],[
'🕺',
'man dancing',
'dance dancing man male boy fun dancer'
],[
'🕴',
'person in suit levitating',
'business person suit man in suit levitating levitate hover jump'
],[
'👯',
'people with bunny ears',
'bunny ear dancer partying perform costume'
],[
'👯‍♂️',
'men with bunny ears',
'bunny ear dancer men partying male bunny boys'
],[
'👯‍♀️',
'women with bunny ears',
'bunny ear dancer partying women female bunny girls'
],[
'🧖',
'person in steamy room',
'sauna steam room hamam steambath relax spa'
],[
'🧖‍♂️',
'man in steamy room',
'sauna steam room male man spa steamroom'
],[
'🧖‍♀️',
'woman in steamy room',
'sauna steam room female woman spa steamroom'
],[
'🧗',
'person climbing',
'climber sport'
],[
'🧗‍♂️',
'man climbing',
'climber sports hobby man male rock'
],[
'🧗‍♀️',
'woman climbing',
'climber sports hobby woman female rock'
],[
'🤺',
'person fencing',
'fencer fencing sword sports'
],[
'🏇',
'horse racing',
'horse jockey racehorse racing animal betting competition gambling luck'
],[
'⛷️',
'skier',
'ski snow sports winter'
],[
'🏂',
'snowboarder',
'ski snow snowboard sports winter'
],[
'🏌',
'person golfing',
'ball golf sports business'
],[
'🏌️‍♂️',
'man golfing',
'golf man sport'
],[
'🏌️‍♀️',
'woman golfing',
'golf woman sports business female'
],[
'🏄',
'person surfing',
'surfing sport sea'
],[
'🏄‍♂️',
'man surfing',
'man surfing sports ocean sea summer beach'
],[
'🏄‍♀️',
'woman surfing',
'surfing woman sports ocean sea summer beach female'
],[
'🚣',
'person rowing boat',
'boat rowboat sport move'
],[
'🚣‍♂️',
'man rowing boat',
'boat man rowboat sports hobby water ship'
],[
'🚣‍♀️',
'woman rowing boat',
'boat rowboat woman sports hobby water ship female'
],[
'🏊',
'person swimming',
'swim sport pool'
],[
'🏊‍♂️',
'man swimming',
'man swim sports exercise human athlete water summer'
],[
'🏊‍♀️',
'woman swimming',
'swim woman sports exercise human athlete water summer female'
],[
'⛹',
'person bouncing ball',
'ball sports human'
],[
'⛹️‍♂️',
'man bouncing ball',
'ball man sport'
],[
'⛹️‍♀️',
'woman bouncing ball',
'ball woman sports human female'
],[
'🏋',
'person lifting weights',
'lifter weight sports training exercise'
],[
'🏋️‍♂️',
'man lifting weights',
'man weight lifter sport'
],[
'🏋️‍♀️',
'woman lifting weights',
'weight lifter woman sports training exercise female'
],[
'🚴',
'person biking',
'bicycle biking cyclist sport move'
],[
'🚴‍♂️',
'man biking',
'bicycle biking cyclist man sports bike exercise hipster'
],[
'🚴‍♀️',
'woman biking',
'bicycle biking cyclist woman sports bike exercise hipster female'
],[
'🚵',
'person mountain biking',
'bicycle bicyclist bike cyclist mountain sport move'
],[
'🚵‍♂️',
'man mountain biking',
'bicycle bike cyclist man mountain transportation sports human race'
],[
'🚵‍♀️',
'woman mountain biking',
'bicycle bike biking cyclist mountain woman transportation sports human race female'
],[
'🤸',
'person cartwheeling',
'cartwheel gymnastics sport gymnastic'
],[
'🤸‍♂️',
'man cartwheeling',
'cartwheel gymnastics man'
],[
'🤸‍♀️',
'woman cartwheeling',
'cartwheel gymnastics woman'
],[
'🤼',
'people wrestling',
'wrestle wrestler sport'
],[
'🤼‍♂️',
'men wrestling',
'men wrestle sports wrestlers'
],[
'🤼‍♀️',
'women wrestling',
'women wrestle sports wrestlers'
],[
'🤽',
'person playing water polo',
'polo water sport'
],[
'🤽‍♂️',
'man playing water polo',
'man water polo sports pool'
],[
'🤽‍♀️',
'woman playing water polo',
'water polo woman sports pool'
],[
'🤾',
'person playing handball',
'ball handball sport'
],[
'🤾‍♂️',
'man playing handball',
'handball man sports'
],[
'🤾‍♀️',
'woman playing handball',
'handball woman sports'
],[
'🤹',
'person juggling',
'balance juggle multitask skill performance'
],[
'🤹‍♂️',
'man juggling',
'juggling man multitask juggle balance skill'
],[
'🤹‍♀️',
'woman juggling',
'juggling multitask woman juggle balance skill'
],[
'🧘',
'person in lotus position',
'meditation yoga serenity meditate'
],[
'🧘‍♂️',
'man in lotus position',
'meditation yoga man male serenity zen mindfulness'
],[
'🧘‍♀️',
'woman in lotus position',
'meditation yoga woman female serenity zen mindfulness'
],[
'🛀',
'person taking bath',
'bath bathtub clean shower bathroom'
],[
'🛌',
'person in bed',
'hotel sleep bed rest'
],[
'🧑‍🤝‍🧑',
'people holding hands',
'couple hand hold holding hands person friendship'
],[
'👭',
'women holding hands',
'couple hand holding hands women pair friendship love like female people human'
],[
'👫',
'woman and man holding hands',
'couple hand hold holding hands man woman pair people human love date dating like affection valentines marriage'
],[
'👬',
'men holding hands',
'couple Gemini holding hands man men twins zodiac pair love like bromance friendship people human'
],[
'💏',
'kiss',
'couple pair valentines love like dating marriage'
],[
'👩‍❤️‍💋‍👨',
'kiss: woman, man',
'couple kiss man woman kiss woman man love'
],[
'👨‍❤️‍💋‍👨',
'kiss: man, man',
'couple kiss man kiss man man pair valentines love like dating marriage'
],[
'👩‍❤️‍💋‍👩',
'kiss: woman, woman',
'couple kiss woman kiss woman woman pair valentines love like dating marriage'
],[
'💑',
'couple with heart',
'couple love pair like affection human dating valentines marriage'
],[
'👩‍❤️‍👨',
'couple with heart: woman, man',
'couple couple with heart love man woman couple with heart woman man'
],[
'👨‍❤️‍👨',
'couple with heart: man, man',
'couple couple with heart love man couple with heart man man pair like affection human dating valentines marriage'
],[
'👩‍❤️‍👩',
'couple with heart: woman, woman',
'couple couple with heart love woman couple with heart woman woman pair like affection human dating valentines marriage'
],[
'👨‍👩‍👦',
'family: man, woman, boy',
'home parents children mom dad father mother man women boy people human'
],[
'👨‍👩‍👧',
'family: man, woman, girl',
'home parents children mom dad father mother man women girl people human'
],[
'👨‍👩‍👧‍👦',
'family: man, woman, girl, boy',
'home parents children mom dad father mother man women girl boy people human'
],[
'👨‍👩‍👦‍👦',
'family: man, woman, boy, boy',
'home parents children mom dad father mother man women boy people human'
],[
'👨‍👩‍👧‍👧',
'family: man, woman, girl, girl',
'home parents children mom dad father mother man women girl people human'
],[
'👨‍👨‍👦',
'family: man, man, boy',
'home parents children dad father man boy people human'
],[
'👨‍👨‍👧',
'family: man, man, girl',
'home parents children dad father man girl people human'
],[
'👨‍👨‍👧‍👦',
'family: man, man, girl, boy',
'home parents children dad father man girl boy people human'
],[
'👨‍👨‍👦‍👦',
'family: man, man, boy, boy',
'home parents children dad father man boy people human'
],[
'👨‍👨‍👧‍👧',
'family: man, man, girl, girl',
'home parents children dad father man girl people human'
],[
'👩‍👩‍👦',
'family: woman, woman, boy',
'home parents children mom mother women boy people human'
],[
'👩‍👩‍👧',
'family: woman, woman, girl',
'home parents children mom mother women girl people human'
],[
'👩‍👩‍👧‍👦',
'family: woman, woman, girl, boy',
'home parents children mom mother women girl boy people human'
],[
'👩‍👩‍👦‍👦',
'family: woman, woman, boy, boy',
'home parents children mom mother women boy people human'
],[
'👩‍👩‍👧‍👧',
'family: woman, woman, girl, girl',
'home parents children mom mother women girl people human'
],[
'👨‍👦',
'family: man, boy',
'home parents children dad father man boy people human'
],[
'👨‍👦‍👦',
'family: man, boy, boy',
'home parents children dad father man boy people human'
],[
'👨‍👧',
'family: man, girl',
'home parents children dad father man girl people human'
],[
'👨‍👧‍👦',
'family: man, girl, boy',
'home parents children dad father man girl boy people human'
],[
'👨‍👧‍👧',
'family: man, girl, girl',
'home parents children dad father man girl people human'
],[
'👩‍👦',
'family: woman, boy',
'home parents children mom mother women boy people human'
],[
'👩‍👦‍👦',
'family: woman, boy, boy',
'home parents children mom mother women boy people human'
],[
'👩‍👧',
'family: woman, girl',
'home parents children mom mother women girl people human'
],[
'👩‍👧‍👦',
'family: woman, girl, boy',
'home parents children mom mother women girl boy people human'
],[
'👩‍👧‍👧',
'family: woman, girl, girl',
'home parents children mom mother women girl people human'
],[
'🗣️',
'speaking head',
'face head silhouette speak speaking user person human sing say talk'
],[
'👤',
'bust in silhouette',
'bust silhouette user person human'
],[
'👥',
'busts in silhouette',
'bust silhouette user person human group team'
],[
'🫂',
'people hugging',
'goodbye hello hug thanks care'
],[
'👪',
'family',
'home parents children mom dad father mother man women girl boy people human'
],[
'🧑‍🧑‍🧒',
'family: adult, adult, child',
'home parents children mom dad father mother man women girl boy people human'
],[
'🧑‍🧑‍🧒‍🧒',
'family: adult, adult, child, child',
'home parents children mom dad father mother man women girl boy people human'
],[
'🧑‍🧒',
'family: adult, child',
'home parents children mom dad father mother man women girl boy people human'
],[
'🧑‍🧒‍🧒',
'family: adult, child, child',
'home parents children mom dad father mother man women girl boy people human'
],[
'👣',
'footprints',
'barefoot clothing footprint print feet tracking walking beach'
],[
'🫆',
'fingerprint',
'clue crime detective fingerprint forensics identity mystery print safety trace'
],[
'🦰',
'red hair',
'ginger redhead'
],[
'🦱',
'curly hair',
'afro curly ringlets'
],[
'🦳',
'white hair',
'gray hair old white'
],[
'🦲',
'bald',
'chemotherapy hairless no hair shaven'
],



// Animals & Nature
[
'🐵',
'monkey face',
'face monkey animal nature circus'
],[
'🐒',
'monkey',
'animal nature banana circus'
],[
'🦍',
'gorilla',
'animal nature circus'
],[
'🦧',
'orangutan',
'ape animal'
],[
'🐶',
'dog face',
'dog face pet animal friend nature woof puppy faithful'
],[
'🐕',
'dog',
'pet animal nature friend doge faithful'
],[
'🦮',
'guide dog',
'accessibility blind guide animal'
],[
'🐕‍🦺',
'service dog',
'accessibility assistance dog service blind animal'
],[
'🐩',
'poodle',
'dog animal 101 nature pet'
],[
'🐺',
'wolf',
'face animal nature wild'
],[
'🦊',
'fox',
'face animal nature'
],[
'🦝',
'raccoon',
'curious sly animal nature'
],[
'🐱',
'cat face',
'cat face pet animal meow nature kitten'
],[
'🐈',
'cat',
'pet animal meow cats'
],[
'🐈‍⬛',
'black cat',
'black cat unlucky superstition luck'
],[
'🦁',
'lion',
'face Leo zodiac animal nature'
],[
'🐯',
'tiger face',
'face tiger animal cat danger wild nature roar'
],[
'🐅',
'tiger',
'animal nature roar'
],[
'🐆',
'leopard',
'animal nature'
],[
'🐴',
'horse face',
'face horse animal brown nature'
],[
'🫎',
'moose',
'animal antlers elk mammal moose canada sweden'
],[
'🫏',
'donkey',
'animal ass burro donkey mammal mule stubborn'
],[
'🐎',
'horse',
'equestrian racehorse racing animal gamble luck'
],[
'🦄',
'unicorn',
'face animal nature mystical'
],[
'🦓',
'zebra',
'stripe animal nature stripes safari'
],[
'🦌',
'deer',
'animal nature horns venison'
],[
'🦬',
'bison',
'buffalo herd wisent ox'
],[
'🐮',
'cow face',
'cow face beef ox animal nature moo milk'
],[
'🐂',
'ox',
'bull Taurus zodiac animal cow beef'
],[
'🐃',
'water buffalo',
'buffalo water animal nature ox cow'
],[
'🐄',
'cow',
'beef ox animal nature moo milk'
],[
'🐷',
'pig face',
'face pig animal oink nature'
],[
'🐖',
'pig',
'sow animal nature'
],[
'🐗',
'boar',
'pig animal nature'
],[
'🐽',
'pig nose',
'face nose pig animal oink'
],[
'🐏',
'ram',
'Aries male sheep zodiac animal nature'
],[
'🐑',
'ewe',
'female sheep animal nature wool shipit'
],[
'🐐',
'goat',
'Capricorn zodiac animal nature'
],[
'🐪',
'camel',
'dromedary hump animal hot desert'
],[
'🐫',
'two-hump camel',
'bactrian camel hump two hump camel animal nature hot desert'
],[
'🦙',
'llama',
'alpaca guanaco vicuña wool animal nature'
],[
'🦒',
'giraffe',
'spots animal nature safari'
],[
'🐘',
'elephant',
'animal nature nose th circus'
],[
'🦣',
'mammoth',
'extinction large tusk woolly elephant tusks'
],[
'🦏',
'rhinoceros',
'animal nature horn'
],[
'🦛',
'hippopotamus',
'hippo animal nature'
],[
'🐭',
'mouse face',
'face mouse animal nature cheese wedge rodent'
],[
'🐁',
'mouse',
'animal nature rodent'
],[
'🐀',
'rat',
'animal mouse rodent'
],[
'🐹',
'hamster',
'face pet animal nature'
],[
'🐰',
'rabbit face',
'bunny face pet rabbit animal nature spring magic'
],[
'🐇',
'rabbit',
'bunny pet animal nature magic spring'
],[
'🐿️',
'chipmunk',
'squirrel animal nature rodent'
],[
'🦫',
'beaver',
'dam animal rodent'
],[
'🦔',
'hedgehog',
'spiny animal nature'
],[
'🦇',
'bat',
'vampire animal nature blind'
],[
'🐻',
'bear',
'face animal nature wild'
],[
'🐻‍❄️',
'polar bear',
'arctic bear white animal'
],[
'🐨',
'koala',
'bear animal nature'
],[
'🐼',
'panda',
'face animal nature'
],[
'🦥',
'sloth',
'lazy slow animal'
],[
'🦦',
'otter',
'fishing playful animal'
],[
'🦨',
'skunk',
'stink animal'
],[
'🦘',
'kangaroo',
'Australia joey jump marsupial animal nature australia hop'
],[
'🦡',
'badger',
'honey badger pester animal nature honey'
],[
'🐾',
'paw prints',
'feet paw print animal tracking footprints dog cat pet'
],[
'🦃',
'turkey',
'bird animal'
],[
'🐔',
'chicken',
'bird animal cluck nature'
],[
'🐓',
'rooster',
'bird animal nature chicken'
],[
'🐣',
'hatching chick',
'baby bird chick hatching animal chicken egg born'
],[
'🐤',
'baby chick',
'baby bird chick animal chicken'
],[
'🐥',
'front-facing baby chick',
'baby bird chick front facing baby chick animal chicken'
],[
'🐦',
'bird',
'animal nature fly tweet spring'
],[
'🐧',
'penguin',
'bird animal nature'
],[
'🕊️',
'dove',
'bird fly peace animal'
],[
'🦅',
'eagle',
'bird animal nature'
],[
'🦆',
'duck',
'bird animal nature mallard'
],[
'🦢',
'swan',
'bird cygnet ugly duckling animal nature'
],[
'🦉',
'owl',
'bird wise animal nature hoot'
],[
'🦤',
'dodo',
'extinction large Mauritius animal bird'
],[
'🪶',
'feather',
'bird flight light plumage fly'
],[
'🦩',
'flamingo',
'flamboyant tropical animal'
],[
'🦚',
'peacock',
'bird ostentatious peahen proud animal nature'
],[
'🦜',
'parrot',
'bird pirate talk animal nature'
],[
'🪽',
'wing',
'angelic aviation bird flying mythology wing'
],[
'🐦‍⬛',
'black bird',
'bird black crow raven rook'
],[
'🪿',
'goose',
'bird fowl wild goose honk silly'
],[
'🐦‍🔥',
'phoenix',
'fantasy firebird phoenix rebirth reincarnation'
],[
'🐸',
'frog',
'face animal nature croak toad'
],[
'🐊',
'crocodile',
'animal nature reptile lizard alligator'
],[
'🐢',
'turtle',
'terrapin tortoise animal slow nature'
],[
'🦎',
'lizard',
'reptile animal nature'
],[
'🐍',
'snake',
'bearer Ophiuchus serpent zodiac animal evil nature hiss python'
],[
'🐲',
'dragon face',
'dragon face fairy tale animal myth nature chinese green'
],[
'🐉',
'dragon',
'fairy tale animal myth nature chinese green'
],[
'🦕',
'sauropod',
'brachiosaurus brontosaurus diplodocus animal nature dinosaur extinct'
],[
'🦖',
'T-Rex',
'Tyrannosaurus Rex t rex animal nature dinosaur tyrannosaurus extinct'
],[
'🐳',
'spouting whale',
'face spouting whale animal nature sea ocean'
],[
'🐋',
'whale',
'animal nature sea ocean'
],[
'🐬',
'dolphin',
'flipper animal nature fish sea ocean fins beach'
],[
'🦭',
'seal',
'sea Lion animal creature sea'
],[
'🐟',
'fish',
'Pisces zodiac animal food nature'
],[
'🐠',
'tropical fish',
'fish tropical animal swim ocean beach nemo'
],[
'🐡',
'blowfish',
'fish animal nature food sea ocean'
],[
'🦈',
'shark',
'fish animal nature sea ocean jaws fins beach'
],[
'🐙',
'octopus',
'animal creature ocean sea nature beach'
],[
'🐚',
'spiral shell',
'shell spiral nature sea beach'
],[
'🪸',
'coral',
'ocean sea reef'
],[
'🪼',
'jellyfish',
'burn invertebrate jellyfish marine ouch stinger tentacles'
],[
'🐌',
'snail',
'slow animal shell'
],[
'🦋',
'butterfly',
'insect pretty animal nature caterpillar'
],[
'🐛',
'bug',
'insect animal nature worm'
],[
'🐜',
'ant',
'insect animal nature bug'
],[
'🐝',
'honeybee',
'bee insect animal nature bug spring honey'
],[
'🪲',
'beetle',
'bug insect'
],[
'🐞',
'lady beetle',
'beetle insect ladybird ladybug animal nature'
],[
'🦗',
'cricket',
'grasshopper Orthoptera animal chirp'
],[
'🪳',
'cockroach',
'insect pest roach pests'
],[
'🕷️',
'spider',
'insect animal arachnid'
],[
'🕸️',
'spider web',
'spider web animal insect arachnid silk'
],[
'🦂',
'scorpion',
'scorpio Scorpio zodiac animal arachnid'
],[
'🦟',
'mosquito',
'disease fever malaria pest virus animal nature insect'
],[
'🪰',
'fly',
'disease maggot pest rotting insect'
],[
'🪱',
'worm',
'annelid earthworm parasite animal'
],[
'🦠',
'microbe',
'amoeba bacteria virus germs'
],[
'💐',
'bouquet',
'flower flowers nature spring'
],[
'🌸',
'cherry blossom',
'blossom cherry flower nature plant spring'
],[
'💮',
'white flower',
'flower japanese spring'
],[
'🪷',
'lotus',
'Buddhism flower Hinduism India purity Vietnam'
],[
'🏵️',
'rosette',
'plant flower decoration military'
],[
'🌹',
'rose',
'flower flowers valentines love spring'
],[
'🥀',
'wilted flower',
'flower wilted plant nature'
],[
'🌺',
'hibiscus',
'flower plant vegetable flowers beach'
],[
'🌻',
'sunflower',
'flower sun nature plant fall'
],[
'🌼',
'blossom',
'blossom flower nature flowers yellow'
],[
'🌷',
'tulip',
'flower flowers plant nature summer spring blossom'
],[
'🪻',
'hyacinth',
'bluebonnet flower hyacinth lavender lupine snapdragon blossom springtime'
],[
'🌱',
'seedling',
'young plant nature grass lawn spring'
],[
'🪴',
'potted plant',
'boring grow house nurturing plant useless greenery'
],[
'🌲',
'evergreen tree',
'tree plant nature'
],[
'🌳',
'deciduous tree',
'deciduous shedding tree plant nature'
],[
'🌴',
'palm tree',
'palm tree plant vegetable nature summer beach mojito tropical'
],[
'🌵',
'cactus',
'plant vegetable nature'
],[
'🌾',
'sheaf of rice',
'ear grain rice nature plant'
],[
'🌿',
'herb',
'leaf vegetable plant medicine weed grass lawn'
],[
'☘️',
'shamrock',
'plant vegetable nature irish clover'
],[
'🍀',
'four leaf clover',
'4 clover four four-leaf clover leaf vegetable plant nature lucky irish'
],[
'🍁',
'maple leaf',
'falling leaf maple nature plant vegetable ca fall'
],[
'🍂',
'fallen leaf',
'falling leaf nature plant vegetable leaves'
],[
'🍃',
'leaf fluttering in wind',
'blow flutter leaf wind nature plant tree vegetable grass lawn spring'
],[
'🪹',
'empty nest',
'nesting birds'
],[
'🪺',
'nest with eggs',
'nesting birds'
],[
'🍄',
'mushroom',
'mushroom toadstool fungus'
],[
'🪾',
'leafless tree',
'bare barren branches dead drought leafless tree trunk winter wood'
],



// Food & Drink
[
'🍇',
'grapes',
'fruit grape food wine'
],[
'🍈',
'melon',
'fruit nature food'
],[
'🍉',
'watermelon',
'fruit food picnic summer'
],[
'🍊',
'tangerine',
'fruit orange food nature'
],[
'🍋',
'lemon',
'citrus fruit nature'
],[
'🍋‍🟩',
'lime',
'citrus fruit lime tropical'
],[
'🍌',
'banana',
'fruit food monkey'
],[
'🍍',
'pineapple',
'fruit nature food'
],[
'🥭',
'mango',
'fruit tropical food'
],[
'🍎',
'red apple',
'apple fruit red mac school'
],[
'🍏',
'green apple',
'apple fruit green nature'
],[
'🍐',
'pear',
'fruit nature food'
],[
'🍑',
'peach',
'fruit nature food'
],[
'🍒',
'cherries',
'berries cherry fruit red food'
],[
'🍓',
'strawberry',
'berry fruit food nature'
],[
'🫐',
'blueberries',
'berry bilberry blue blueberry fruit'
],[
'🥝',
'kiwi fruit',
'food fruit kiwi'
],[
'🍅',
'tomato',
'fruit vegetable nature food'
],[
'🫒',
'olive',
'food fruit'
],[
'🥥',
'coconut',
'palm piña colada fruit nature food'
],[
'🥑',
'avocado',
'food fruit'
],[
'🍆',
'eggplant',
'aubergine vegetable nature food'
],[
'🥔',
'potato',
'food vegetable tuber vegatable starch'
],[
'🥕',
'carrot',
'food vegetable orange'
],[
'🌽',
'ear of corn',
'corn ear maize maze food vegetable plant'
],[
'🌶️',
'hot pepper',
'hot pepper food spicy chilli chili'
],[
'🫑',
'bell pepper',
'capsicum pepper vegetable fruit plant'
],[
'🥒',
'cucumber',
'food pickle vegetable fruit'
],[
'🥬',
'leafy green',
'bok choy cabbage kale lettuce food vegetable plant'
],[
'🥦',
'broccoli',
'wild cabbage fruit food vegetable'
],[
'🧄',
'garlic',
'flavoring food spice cook'
],[
'🧅',
'onion',
'flavoring cook food spice'
],[
'🥜',
'peanuts',
'food nut peanut vegetable'
],[
'🫘',
'beans',
'food kidney legume'
],[
'🌰',
'chestnut',
'plant food squirrel'
],[
'🫚',
'ginger root',
'beer ginger root spice flavour cooking'
],[
'🫛',
'pea pod',
'beans edamame legume pea pod vegetable green'
],[
'🍄‍🟫',
'brown mushroom',
'brown food fungi fungus mushroom nature pizza portobello shiitake shroom spore sprout toppings truffle vegetable vegetarian veggie'
],[
'🫜',
'root vegetable',
'beet food garden radish root salad turnip vegetable vegetarian'
],[
'🍞',
'bread',
'loaf food wheat breakfast toast'
],[
'🥐',
'croissant',
'bread breakfast food french roll'
],[
'🥖',
'baguette bread',
'baguette bread food french'
],[
'🫓',
'flatbread',
'arepa lavash naan pita flour food'
],[
'🥨',
'pretzel',
'twisted convoluted food bread'
],[
'🥯',
'bagel',
'bakery breakfast schmear food bread'
],[
'🥞',
'pancakes',
'breakfast crêpe food hotcake pancake flapjacks hotcakes'
],[
'🧇',
'waffle',
'breakfast indecisive iron food'
],[
'🧀',
'cheese wedge',
'cheese food chadder'
],[
'🍖',
'meat on bone',
'bone meat good food drumstick'
],[
'🍗',
'poultry leg',
'bone chicken drumstick leg poultry food meat bird turkey'
],[
'🥩',
'cut of meat',
'chop lambchop porkchop steak food cow meat cut'
],[
'🥓',
'bacon',
'breakfast food meat pork pig'
],[
'🍔',
'hamburger',
'burger meat fast food beef cheeseburger mcdonalds burger king'
],[
'🍟',
'french fries',
'french fries chips snack fast food'
],[
'🍕',
'pizza',
'cheese slice food party'
],[
'🌭',
'hot dog',
'frankfurter hotdog sausage food'
],[
'🥪',
'sandwich',
'bread food lunch'
],[
'🌮',
'taco',
'mexican food'
],[
'🌯',
'burrito',
'mexican wrap food'
],[
'🫔',
'tamale',
'mexican wrapped food masa'
],[
'🥙',
'stuffed flatbread',
'falafel flatbread food gyro kebab stuffed'
],[
'🧆',
'falafel',
'chickpea meatball food'
],[
'🥚',
'egg',
'breakfast food chicken'
],[
'🍳',
'cooking',
'breakfast egg frying pan food kitchen'
],[
'🥘',
'shallow pan of food',
'casserole food paella pan shallow cooking'
],[
'🍲',
'pot of food',
'pot stew food meat soup'
],[
'🫕',
'fondue',
'cheese chocolate melted pot Swiss food'
],[
'🥣',
'bowl with spoon',
'breakfast cereal congee oatmeal porridge food'
],[
'🥗',
'green salad',
'food green salad healthy lettuce'
],[
'🍿',
'popcorn',
'food movie theater films snack'
],[
'🧈',
'butter',
'dairy food cook'
],[
'🧂',
'salt',
'condiment shaker'
],[
'🥫',
'canned food',
'can food soup'
],[
'🍱',
'bento box',
'bento box food japanese'
],[
'🍘',
'rice cracker',
'cracker rice food japanese'
],[
'🍙',
'rice ball',
'ball Japanese rice food japanese'
],[
'🍚',
'cooked rice',
'cooked rice food china asian'
],[
'🍛',
'curry rice',
'curry rice food spicy hot indian'
],[
'🍜',
'steaming bowl',
'bowl noodle ramen steaming food japanese chopsticks'
],[
'🍝',
'spaghetti',
'pasta food italian noodle'
],[
'🍠',
'roasted sweet potato',
'potato roasted sweet food nature'
],[
'🍢',
'oden',
'kebab seafood skewer stick food japanese'
],[
'🍣',
'sushi',
'food fish japanese rice'
],[
'🍤',
'fried shrimp',
'fried prawn shrimp tempura food animal appetizer summer'
],[
'🍥',
'fish cake with swirl',
'cake fish pastry swirl food japan sea beach narutomaki pink kamaboko surimi ramen'
],[
'🥮',
'moon cake',
'autumn festival yuèbǐng food'
],[
'🍡',
'dango',
'dessert Japanese skewer stick sweet food japanese barbecue meat'
],[
'🥟',
'dumpling',
'empanada gyōza jiaozi pierogi potsticker food'
],[
'🥠',
'fortune cookie',
'prophecy food'
],[
'🥡',
'takeout box',
'oyster pail food leftovers'
],[
'🦀',
'crab',
'Cancer zodiac animal crustacean'
],[
'🦞',
'lobster',
'bisque claws seafood animal nature'
],[
'🦐',
'shrimp',
'food shellfish small animal ocean nature seafood'
],[
'🦑',
'squid',
'food molusc animal nature ocean sea'
],[
'🦪',
'oyster',
'diving pearl food'
],[
'🍦',
'soft ice cream',
'cream dessert ice icecream soft sweet food hot summer'
],[
'🍧',
'shaved ice',
'dessert ice shaved sweet hot summer'
],[
'🍨',
'ice cream',
'cream dessert ice sweet food hot'
],[
'🍩',
'doughnut',
'breakfast dessert donut sweet food snack'
],[
'🍪',
'cookie',
'dessert sweet food snack oreo chocolate'
],[
'🎂',
'birthday cake',
'birthday cake celebration dessert pastry sweet food'
],[
'🍰',
'shortcake',
'cake dessert pastry slice sweet food'
],[
'🧁',
'cupcake',
'bakery sweet food dessert'
],[
'🥧',
'pie',
'filling pastry fruit meat food dessert'
],[
'🍫',
'chocolate bar',
'bar chocolate dessert sweet food snack'
],[
'🍬',
'candy',
'dessert sweet snack lolly'
],[
'🍭',
'lollipop',
'candy dessert sweet food snack'
],[
'🍮',
'custard',
'dessert pudding sweet food'
],[
'🍯',
'honey pot',
'honey honeypot pot sweet bees kitchen'
],[
'🍼',
'baby bottle',
'baby bottle drink milk food container'
],[
'🥛',
'glass of milk',
'drink glass milk beverage cow'
],[
'☕',
'hot beverage',
'beverage coffee drink hot steaming tea caffeine latte espresso'
],[
'🫖',
'teapot',
'drink pot tea hot'
],[
'🍵',
'teacup without handle',
'beverage cup drink tea teacup bowl breakfast green british'
],[
'🍶',
'sake',
'bar beverage bottle cup drink wine drunk japanese alcohol booze'
],[
'🍾',
'bottle with popping cork',
'bar bottle cork drink popping wine celebration'
],[
'🍷',
'wine glass',
'bar beverage drink glass wine drunk alcohol booze'
],[
'🍸',
'cocktail glass',
'bar cocktail drink glass drunk alcohol beverage booze mojito'
],[
'🍹',
'tropical drink',
'bar drink tropical beverage cocktail summer beach alcohol booze mojito'
],[
'🍺',
'beer mug',
'bar beer drink mug relax beverage drunk party pub summer alcohol booze'
],[
'🍻',
'clinking beer mugs',
'bar beer clink drink mug relax beverage drunk party pub summer alcohol booze'
],[
'🥂',
'clinking glasses',
'celebrate clink drink glass beverage party alcohol cheers wine champagne toast'
],[
'🥃',
'tumbler glass',
'glass liquor shot tumbler whisky drink beverage drunk alcohol booze bourbon scotch'
],[
'🫗',
'pouring liquid',
'drink empty glass spill'
],[
'🥤',
'cup with straw',
'juice soda malt soft drink water drink'
],[
'🧋',
'bubble tea',
'bubble milk pearl tea taiwan boba milk tea straw'
],[
'🧃',
'beverage box',
'beverage box juice straw sweet drink'
],[
'🧉',
'mate',
'drink tea beverage'
],[
'🧊',
'ice',
'cold ice cube iceberg water'
],[
'🥢',
'chopsticks',
'hashi jeotgarak kuaizi food'
],[
'🍽️',
'fork and knife with plate',
'cooking fork knife plate food eat meal lunch dinner restaurant'
],[
'🍴',
'fork and knife',
'cooking cutlery fork knife kitchen'
],[
'🥄',
'spoon',
'tableware cutlery kitchen'
],[
'🔪',
'kitchen knife',
'cooking hocho knife tool weapon blade cutlery kitchen'
],[
'🫙',
'jar',
'condiment container empty sauce store'
],[
'🏺',
'amphora',
'Aquarius cooking drink jug zodiac vase jar'
],



// Travel & Places
[
'🌍',
'globe showing Europe-Africa',
'Africa earth Europe globe world globe showing europe africa international'
],[
'🌎',
'globe showing Americas',
'Americas earth globe world globe showing americas USA international'
],[
'🌏',
'globe showing Asia-Australia',
'Asia Australia earth globe world globe showing asia australia east international'
],[
'🌐',
'globe with meridians',
'earth globe meridians world international internet interweb i18n'
],[
'🗺️',
'world map',
'map world location direction'
],[
'🗾',
'map of Japan',
'Japan map map of japan nation country japanese asia'
],[
'🧭',
'compass',
'magnetic navigation orienteering'
],[
'🏔️',
'snow-capped mountain',
'cold mountain snow snow capped mountain photo nature environment winter'
],[
'⛰️',
'mountain',
'photo nature environment'
],[
'🌋',
'volcano',
'eruption mountain photo nature disaster'
],[
'🗻',
'mount fuji',
'fuji mountain photo nature japanese'
],[
'🏕️',
'camping',
'photo outdoors tent'
],[
'☂️',
'beach with umbrella',
'beach umbrella weather summer sunny sand mojito'
],[
'🏜️',
'desert',
'photo warm saharah'
],[
'🏝️',
'desert island',
'desert island photo tropical mojito'
],[
'🏞️',
'national park',
'park photo environment nature'
],[
'🏟️',
'stadium',
'photo place sports concert venue'
],[
'🏛️',
'classical building',
'classical art culture history'
],[
'🏗️',
'building construction',
'construction wip working progress'
],[
'🧱',
'brick',
'bricks clay mortar wall'
],[
'🪨',
'rock',
'boulder heavy solid stone'
],[
'🪵',
'wood',
'log lumber timber nature trunk'
],[
'🛖',
'hut',
'house roundhouse yurt structure'
],[
'🏘️',
'houses',
'buildings photo'
],[
'🏚️',
'derelict house',
'derelict house abandon evict broken building'
],[
'🏠',
'house',
'home building'
],[
'🏡',
'house with garden',
'garden home house plant nature'
],[
'🏢',
'office building',
'building bureau work'
],[
'🏣',
'Japanese post office',
'Japanese post japanese post office building envelope communication'
],[
'🏤',
'post office',
'European post building email'
],[
'🏥',
'hospital',
'doctor medicine building health surgery'
],[
'🏦',
'bank',
'building money sales cash business enterprise'
],[
'🏨',
'hotel',
'building accomodation checkin'
],[
'🏩',
'love hotel',
'hotel love like affection dating'
],[
'🏪',
'convenience store',
'convenience store building shopping groceries'
],[
'🏫',
'school',
'building student education learn teach'
],[
'🏬',
'department store',
'department store building shopping mall'
],[
'🏭',
'factory',
'building industry pollution smoke'
],[
'🏯',
'Japanese castle',
'castle Japanese japanese castle photo building'
],[
'🏰',
'castle',
'European building royalty history'
],[
'💒',
'wedding',
'chapel romance love like affection couple marriage bride groom'
],[
'🗼',
'Tokyo tower',
'Tokyo tower tokyo tower photo japanese'
],[
'🗽',
'Statue of Liberty',
'liberty statue statue of liberty american newyork'
],[
'⛪',
'church',
'Christian cross religion building christ'
],[
'🕌',
'mosque',
'islam Muslim religion worship minaret'
],[
'🛕',
'hindu temple',
'hindu temple religion'
],[
'🕍',
'synagogue',
'Jew Jewish religion temple judaism worship jewish'
],[
'⛩️',
'shinto shrine',
'religion shinto shrine temple japan kyoto'
],[
'🕋',
'kaaba',
'islam Muslim religion mecca mosque'
],[
'⛲',
'fountain',
'photo summer water fresh'
],[
'⛺',
'tent',
'camping photo outdoors'
],[
'🌁',
'foggy',
'fog photo mountain'
],[
'🌃',
'night with stars',
'night star evening city downtown'
],[
'🏙️',
'cityscape',
'city photo night life urban'
],[
'🌄',
'sunrise over mountains',
'morning mountain sun sunrise view vacation photo'
],[
'🌅',
'sunrise',
'morning sun view vacation photo'
],[
'🌆',
'cityscape at dusk',
'city dusk evening landscape sunset photo sky buildings'
],[
'🌇',
'sunset',
'dusk sun photo good morning dawn'
],[
'🌉',
'bridge at night',
'bridge night photo sanfrancisco'
],[
'♨️',
'hot springs',
'hot hotsprings springs steaming bath warm relax'
],[
'🎠',
'carousel horse',
'carousel horse photo carnival'
],[
'🛝',
'playground slide',
'amusement park play'
],[
'🎡',
'ferris wheel',
'amusement park ferris wheel photo carnival londoneye'
],[
'🎢',
'roller coaster',
'amusement park coaster roller carnival playground photo fun'
],[
'💈',
'barber pole',
'barber haircut pole hair salon style'
],[
'🎪',
'circus tent',
'circus tent festival carnival party'
],[
'🚂',
'locomotive',
'engine railway steam train transportation vehicle'
],[
'🚃',
'railway car',
'car electric railway train tram trolleybus transportation vehicle'
],[
'🚄',
'high-speed train',
'railway shinkansen speed train high speed train transportation vehicle'
],[
'🚅',
'bullet train',
'bullet railway shinkansen speed train transportation vehicle fast public travel'
],[
'🚆',
'train',
'railway transportation vehicle'
],[
'🚇',
'metro',
'subway transportation blue-square mrt underground tube'
],[
'🚈',
'light rail',
'railway transportation vehicle'
],[
'🚉',
'station',
'railway train transportation vehicle public'
],[
'🚊',
'tram',
'trolleybus transportation vehicle'
],[
'🚝',
'monorail',
'vehicle transportation'
],[
'🚞',
'mountain railway',
'car mountain railway transportation vehicle'
],[
'🚋',
'tram car',
'car tram trolleybus transportation vehicle carriage public travel'
],[
'🚌',
'bus',
'vehicle car transportation'
],[
'🚍',
'oncoming bus',
'bus oncoming vehicle transportation'
],[
'🚎',
'trolleybus',
'bus tram trolley bart transportation vehicle'
],[
'🚐',
'minibus',
'bus vehicle car transportation'
],[
'🚑',
'ambulance',
'vehicle health 911 hospital'
],[
'🚒',
'fire engine',
'engine fire truck transportation cars vehicle'
],[
'🚓',
'police car',
'car patrol police vehicle cars transportation law legal enforcement'
],[
'🚔',
'oncoming police car',
'car oncoming police vehicle law legal enforcement 911'
],[
'🚕',
'taxi',
'vehicle uber cars transportation'
],[
'🚖',
'oncoming taxi',
'oncoming taxi vehicle cars uber'
],[
'🚗',
'automobile',
'car red transportation vehicle'
],[
'🚘',
'oncoming automobile',
'automobile car oncoming vehicle transportation'
],[
'🚙',
'sport utility vehicle',
'recreational sport utility transportation vehicle'
],[
'🛻',
'pickup truck',
'pick-up pickup truck car transportation'
],[
'🚚',
'delivery truck',
'delivery truck cars transportation'
],[
'🚛',
'articulated lorry',
'lorry semi truck vehicle cars transportation express'
],[
'🚜',
'tractor',
'vehicle car farming agriculture'
],[
'🏎️',
'racing car',
'car racing sports race fast formula f1'
],[
'🏍️',
'motorcycle',
'racing race sports fast'
],[
'🛵',
'motor scooter',
'motor scooter vehicle vespa sasha'
],[
'🦽',
'manual wheelchair',
'accessibility'
],[
'🦼',
'motorized wheelchair',
'accessibility'
],[
'🛺',
'auto rickshaw',
'tuk tuk move transportation'
],[
'🚲',
'bicycle',
'bike sports exercise hipster'
],[
'🛴',
'kick scooter',
'kick scooter vehicle razor'
],[
'🛹',
'skateboard',
'board'
],[
'🛼',
'roller skate',
'roller skate footwear sports'
],[
'🚏',
'bus stop',
'bus busstop stop transportation wait'
],[
'🛣️',
'motorway',
'highway road cupertino interstate'
],[
'🛤️',
'railway track',
'railway train transportation'
],[
'🛢️',
'oil drum',
'drum oil barrell'
],[
'⛽',
'fuel pump',
'diesel fuel fuelpump gas pump station gas station petroleum'
],[
'🛞',
'wheel',
'circle tire turn'
],[
'🚨',
'police car light',
'beacon car light police revolving ambulance 911 emergency alert error pinged law legal'
],[
'🚥',
'horizontal traffic light',
'light signal traffic transportation'
],[
'🚦',
'vertical traffic light',
'light signal traffic transportation driving'
],[
'🛑',
'stop sign',
'octagonal sign stop'
],[
'🚧',
'construction',
'barrier wip progress caution warning'
],[
'⚓',
'anchor',
'ship tool ferry sea boat'
],[
'🛟',
'ring buoy',
'float life preserver saver rescue safety'
],[
'⛵',
'sailboat',
'boat resort sea yacht ship summer transportation water sailing'
],[
'🛶',
'canoe',
'boat paddle water ship'
],[
'🚤',
'speedboat',
'boat ship transportation vehicle summer'
],[
'🛳️',
'passenger ship',
'passenger ship yacht cruise ferry'
],[
'⛴️',
'ferry',
'boat passenger ship yacht'
],[
'🛥️',
'motor boat',
'boat motorboat ship'
],[
'🚢',
'ship',
'boat passenger transportation titanic deploy'
],[
'✈️',
'airplane',
'aeroplane vehicle transportation flight fly'
],[
'🛩️',
'small airplane',
'aeroplane airplane flight transportation fly vehicle'
],[
'🛫',
'airplane departure',
'aeroplane airplane check-in departure departures airport flight landing'
],[
'🛬',
'airplane arrival',
'aeroplane airplane arrivals arriving landing airport flight boarding'
],[
'🪂',
'parachute',
'hang-glide parasail skydive fly glide'
],[
'💺',
'seat',
'chair sit airplane transport bus flight fly'
],[
'🚁',
'helicopter',
'vehicle transportation fly'
],[
'🚟',
'suspension railway',
'railway suspension vehicle transportation'
],[
'🚠',
'mountain cableway',
'cable gondola mountain transportation vehicle ski'
],[
'🚡',
'aerial tramway',
'aerial cable car gondola tramway transportation vehicle ski'
],[
'🛰️',
'satellite',
'space communication gps orbit spaceflight NASA ISS'
],[
'🚀',
'rocket',
'space launch ship staffmode NASA outer space fly'
],[
'🛸',
'flying saucer',
'UFO transportation vehicle ufo'
],[
'🛎️',
'bellhop bell',
'bell bellhop hotel service'
],[
'🧳',
'luggage',
'packing travel'
],[
'⌛',
'hourglass done',
'sand timer time clock oldschool limit exam quiz test'
],[
'⏳',
'hourglass not done',
'hourglass sand timer oldschool time countdown'
],[
'⌚',
'watch',
'clock time accessories'
],[
'⏰',
'alarm clock',
'alarm clock time wake'
],[
'⏱️',
'stopwatch',
'clock time deadline'
],[
'⏲️',
'timer clock',
'clock timer alarm'
],[
'🕰️',
'mantelpiece clock',
'clock time'
],[
'🕛',
'twelve o’clock',
'00 12 12:00 clock o’clock twelve twelve o clock time noon midnight midday late early schedule'
],[
'🕧',
'twelve-thirty',
'12 12:30 clock thirty twelve twelve thirty time late early schedule'
],[
'🕐',
'one o’clock',
'00 1 1:00 clock o’clock one one o clock time late early schedule'
],[
'🕜',
'one-thirty',
'1 1:30 clock one thirty one thirty time late early schedule'
],[
'🕑',
'two o’clock',
'00 2 2:00 clock o’clock two two o clock time late early schedule'
],[
'🕝',
'two-thirty',
'2 2:30 clock thirty two two thirty time late early schedule'
],[
'🕒',
'three o’clock',
'00 3 3:00 clock o’clock three three o clock time late early schedule'
],[
'🕞',
'three-thirty',
'3 3:30 clock thirty three three thirty time late early schedule'
],[
'🕓',
'four o’clock',
'00 4 4:00 clock four o’clock four o clock time late early schedule'
],[
'🕟',
'four-thirty',
'4 4:30 clock four thirty four thirty time late early schedule'
],[
'🕔',
'five o’clock',
'00 5 5:00 clock five o’clock five o clock time late early schedule'
],[
'🕠',
'five-thirty',
'5 5:30 clock five thirty five thirty time late early schedule'
],[
'🕕',
'six o’clock',
'00 6 6:00 clock o’clock six six o clock time late early schedule dawn dusk'
],[
'🕡',
'six-thirty',
'6 6:30 clock six thirty six thirty time late early schedule'
],[
'🕖',
'seven o’clock',
'00 7 7:00 clock o’clock seven seven o clock time late early schedule'
],[
'🕢',
'seven-thirty',
'7 7:30 clock seven thirty seven thirty time late early schedule'
],[
'🕗',
'eight o’clock',
'00 8 8:00 clock eight o’clock eight o clock time late early schedule'
],[
'🕣',
'eight-thirty',
'8 8:30 clock eight thirty eight thirty time late early schedule'
],[
'🕘',
'nine o’clock',
'00 9 9:00 clock nine o’clock nine o clock time late early schedule'
],[
'🕤',
'nine-thirty',
'9 9:30 clock nine thirty nine thirty time late early schedule'
],[
'🕙',
'ten o’clock',
'00 10 10:00 clock o’clock ten ten o clock time late early schedule'
],[
'🕥',
'ten-thirty',
'10 10:30 clock ten thirty ten thirty time late early schedule'
],[
'🕚',
'eleven o’clock',
'00 11 11:00 clock eleven o’clock eleven o clock time late early schedule'
],[
'🕦',
'eleven-thirty',
'11 11:30 clock eleven thirty eleven thirty time late early schedule'
],[
'🌑',
'new moon',
'dark moon nature twilight planet space night evening sleep'
],[
'🌒',
'waxing crescent moon',
'crescent moon waxing nature twilight planet space night evening sleep'
],[
'🌓',
'first quarter moon',
'moon quarter nature twilight planet space night evening sleep'
],[
'🌔',
'waxing gibbous moon',
'gibbous moon waxing nature night sky gray twilight planet space evening sleep'
],[
'🌕',
'full moon',
'full moon nature yellow twilight planet space night evening sleep'
],[
'🌖',
'waning gibbous moon',
'gibbous moon waning nature twilight planet space night evening sleep waxing gibbous moon'
],[
'🌗',
'last quarter moon',
'moon quarter nature twilight planet space night evening sleep'
],[
'🌘',
'waning crescent moon',
'crescent moon waning nature twilight planet space night evening sleep'
],[
'🌙',
'crescent moon',
'crescent moon night sleep sky evening magic'
],[
'🌚',
'new moon face',
'face moon nature twilight planet space night evening sleep'
],[
'🌛',
'first quarter moon face',
'face moon quarter nature twilight planet space night evening sleep'
],[
'🌜',
'last quarter moon face',
'face moon quarter nature twilight planet space night evening sleep'
],[
'🌡️',
'thermometer',
'weather temperature hot cold'
],[
'☀️',
'sun',
'bright rays sunny weather nature brightness summer beach spring'
],[
'🌝',
'full moon face',
'bright face full moon nature twilight planet space night evening sleep'
],[
'🌞',
'sun with face',
'bright face sun nature morning sky'
],[
'🪐',
'ringed planet',
'saturn saturnine outerspace'
],[
'⭐',
'star',
'night yellow'
],[
'🌟',
'glowing star',
'glittery glow shining sparkle star night awesome good magic'
],[
'🌠',
'shooting star',
'falling shooting star night photo'
],[
'🌌',
'milky way',
'space photo stars'
],[
'☁️',
'cloud',
'weather sky'
],[
'⛅',
'sun behind cloud',
'cloud sun weather nature cloudy morning fall spring'
],[
'⛈️',
'cloud with lightning and rain',
'cloud rain thunder weather lightning'
],[
'🌤️',
'sun behind small cloud',
'cloud sun weather'
],[
'🌥️',
'sun behind large cloud',
'cloud sun weather'
],[
'🌦️',
'sun behind rain cloud',
'cloud rain sun weather'
],[
'🌧️',
'cloud with rain',
'cloud rain weather'
],[
'🌨️',
'cloud with snow',
'cloud cold snow weather'
],[
'🌩️',
'cloud with lightning',
'cloud lightning weather thunder'
],[
'🌪️',
'tornado',
'cloud whirlwind weather cyclone twister'
],[
'🌫️',
'fog',
'cloud weather'
],[
'🌫️',
'wind face',
'blow cloud face wind gust air'
],[
'🌀',
'cyclone',
'dizzy hurricane twister typhoon weather swirl blue cloud vortex spiral whirlpool spin tornado'
],[
'🌈',
'rainbow',
'rain nature happy unicorn face photo sky spring'
],[
'🌂',
'closed umbrella',
'clothing rain umbrella weather drizzle'
],[
'☂️',
'umbrella',
'clothing rain weather spring'
],[
'☔',
'umbrella with rain drops',
'clothing drop rain umbrella rainy weather spring'
],[
'⛱️',
'umbrella on ground',
'rain sun umbrella weather summer'
],[
'⚡',
'high voltage',
'danger electric lightning voltage zap thunder weather lightning bolt fast'
],[
'❄️',
'snowflake',
'cold snow winter season weather christmas xmas'
],[
'☃️',
'snowman',
'cold snow winter season weather christmas xmas frozen'
],[
'⛄',
'snowman without snow',
'cold snow snowman winter season weather christmas xmas frozen without snow'
],[
'☄️',
'comet',
'space'
],[
'🔥',
'fire',
'flame tool hot cook'
],[
'💧',
'droplet',
'cold comic drop sweat water drip faucet spring'
],[
'🌊',
'water wave',
'ocean water wave sea nature tsunami disaster'
],



// Activities
[
'🎃',
'jack-o-lantern',
'celebration halloween jack lantern jack o lantern light pumpkin creepy fall'
],[
'🎄',
'Christmas tree',
'celebration Christmas tree christmas tree festival vacation december xmas'
],[
'🎆',
'fireworks',
'celebration photo festival carnival congratulations'
],[
'🎇',
'sparkler',
'celebration fireworks sparkle stars night shine'
],[
'🧨',
'firecracker',
'dynamite explosive fireworks boom explode explosion'
],[
'✨',
'sparkles',
'* sparkle star stars shine shiny cool awesome good magic'
],[
'🎈',
'balloon',
'celebration party birthday circus'
],[
'🎉',
'party popper',
'celebration party popper tada congratulations birthday magic circus'
],[
'🎊',
'confetti ball',
'ball celebration confetti festival party birthday circus'
],[
'🎋',
'tanabata tree',
'banner celebration Japanese tree plant nature branch summer'
],[
'🎍',
'pine decoration',
'bamboo celebration Japanese pine plant nature vegetable panda'
],[
'🎎',
'Japanese dolls',
'celebration doll festival Japanese japanese dolls japanese toy kimono'
],[
'🎏',
'carp streamer',
'carp celebration streamer fish japanese koinobori banner'
],[
'🎐',
'wind chime',
'bell celebration chime wind nature ding spring'
],[
'🎑',
'moon viewing ceremony',
'celebration ceremony moon photo japan asia tsukimi'
],[
'🧧',
'red envelope',
'gift good luck hóngbāo lai see money'
],[
'🎀',
'ribbon',
'celebration decoration pink girl bowtie'
],[
'🎁',
'wrapped gift',
'box celebration gift present wrapped birthday christmas xmas'
],[
'🎗️',
'reminder ribbon',
'celebration reminder ribbon sports cause support awareness'
],[
'🎟️',
'admission tickets',
'admission ticket sports concert entrance'
],[
'🎫',
'ticket',
'admission event concert pass'
],[
'🎖️',
'military medal',
'celebration medal military award winning army'
],[
'🏆',
'trophy',
'prize win award contest place ftw ceremony'
],[
'🏅',
'sports medal',
'medal award winning'
],[
'🥇',
'1st place medal',
'first gold medal award winning'
],[
'🥈',
'2nd place medal',
'medal second silver award'
],[
'🥉',
'3rd place medal',
'bronze medal third award'
],[
'⚽',
'soccer ball',
'ball football soccer sports'
],[
'⚾',
'baseball',
'ball sports balls'
],[
'🥎',
'softball',
'ball glove underarm sports balls'
],[
'🏀',
'basketball',
'ball hoop sports balls NBA'
],[
'🏐',
'volleyball',
'ball game sports balls'
],[
'🏈',
'american football',
'american ball football sports balls NFL'
],[
'🏉',
'rugby football',
'ball football rugby sports team'
],[
'🎾',
'tennis',
'ball racquet sports balls green'
],[
'🥏',
'flying disc',
'ultimate sports frisbee'
],[
'🎳',
'bowling',
'ball game sports fun play'
],[
'🏏',
'cricket game',
'ball bat game sports'
],[
'🏑',
'field hockey',
'ball field game hockey stick sports'
],[
'🏒',
'ice hockey',
'game hockey ice puck stick sports'
],[
'🥍',
'lacrosse',
'ball goal stick sports'
],[
'🏓',
'ping pong',
'ball bat game paddle table tennis sports pingpong'
],[
'🏸',
'badminton',
'birdie game racquet shuttlecock sports'
],[
'🥊',
'boxing glove',
'boxing glove sports fighting'
],[
'🥋',
'martial arts uniform',
'judo karate martial arts taekwondo uniform'
],[
'🥅',
'goal net',
'goal net sports'
],[
'⛳',
'flag in hole',
'golf hole sports business flag summer'
],[
'⛸️',
'ice skate',
'ice skate sports'
],[
'🎣',
'fishing pole',
'fish pole food hobby summer'
],[
'🤿',
'diving mask',
'diving scuba snorkeling sport ocean'
],[
'🎽',
'running shirt',
'athletics running sash shirt play pageant'
],[
'🎿',
'skis',
'ski snow sports winter cold'
],[
'🛷',
'sled',
'sledge sleigh luge toboggan'
],[
'🥌',
'curling stone',
'game rock sports'
],[
'🎯',
'bullseye',
'dart direct hit game hit target play bar'
],[
'🪀',
'yo-yo',
'fluctuate toy yo yo'
],[
'🪁',
'kite',
'fly soar wind'
],[
'🔫',
'water pistol',
'gun handgun pistol revolver tool water weapon violence'
],[
'🎱',
'pool 8 ball',
'8 ball billiard eight game pool hobby luck magic'
],[
'🔮',
'crystal ball',
'ball crystal fairy tale fantasy fortune tool disco party magic circus fortune teller'
],[
'🪄',
'magic wand',
'magic witch wizard supernature power'
],[
'🎮',
'video game',
'controller game play console PS4'
],[
'🕹️',
'joystick',
'game video game play'
],[
'🎰',
'slot machine',
'game slot bet gamble vegas fruit machine luck casino'
],[
'🎲',
'game die',
'dice die game random tabletop play luck'
],[
'🧩',
'puzzle piece',
'clue interlocking jigsaw piece puzzle'
],[
'🧸',
'teddy bear',
'plaything plush stuffed toy'
],[
'🪅',
'piñata',
'celebration party pinata mexico candy'
],[
'🪩',
'mirror ball',
'dance disco glitter party'
],[
'🪆',
'nesting dolls',
'doll nesting russia matryoshka toy'
],[
'♠️',
'spade suit',
'card game poker cards suits magic'
],[
'♥️',
'heart suit',
'card game poker cards magic suits'
],[
'♦️',
'diamond suit',
'card game poker cards magic suits'
],[
'♣️',
'club suit',
'card game poker cards magic suits'
],[
'♟️',
'chess pawn',
'chess dupe expendable'
],[
'🃏',
'joker',
'card game wildcard poker cards play magic'
],[
'🀄',
'mahjong red dragon',
'game mahjong red play chinese kanji'
],[
'🎴',
'flower playing cards',
'card flower game Japanese playing sunset red'
],[
'🎭',
'performing arts',
'art mask performing theater theatre acting drama'
],[
'🖼️',
'framed picture',
'art frame museum painting picture photography'
],[
'🎨',
'artist palette',
'art museum painting palette design paint draw colors'
],[
'🧵',
'thread',
'needle sewing spool string'
],[
'🪡',
'sewing needle',
'embroidery needle sewing stitches sutures tailoring'
],[
'🧶',
'yarn',
'ball crochet knit'
],[
'🪢',
'knot',
'rope tangled tie twine twist scout'
],



// Objects
[
'👓',
'glasses',
'clothing eye eyeglasses eyewear fashion accessories eyesight nerdy dork geek'
],[
'🕶️',
'sunglasses',
'dark eye eyewear glasses face cool accessories'
],[
'🥽',
'goggles',
'eye protection swimming welding eyes protection safety'
],[
'🥼',
'lab coat',
'doctor experiment scientist chemist'
],[
'🦺',
'safety vest',
'emergency safety vest protection'
],[
'👔',
'necktie',
'clothing tie shirt suitup formal fashion cloth business'
],[
'👕',
't-shirt',
'clothing shirt tshirt t shirt fashion cloth casual tee'
],[
'👖',
'jeans',
'clothing pants trousers fashion shopping'
],[
'🧣',
'scarf',
'neck winter clothes'
],[
'🧤',
'gloves',
'hand hands winter clothes'
],[
'🧥',
'coat',
'jacket'
],[
'🧦',
'socks',
'stocking stockings clothes'
],[
'👗',
'dress',
'clothing clothes fashion shopping'
],[
'👘',
'kimono',
'clothing dress fashion women female japanese'
],[
'🥻',
'sari',
'clothing dress'
],[
'🩱',
'one-piece swimsuit',
'bathing suit one piece swimsuit fashion'
],[
'🩲',
'briefs',
'bathing suit one-piece swimsuit underwear clothing'
],[
'🩳',
'shorts',
'bathing suit pants underwear clothing'
],[
'👙',
'bikini',
'clothing swim swimming female woman girl fashion beach summer'
],[
'👚',
'woman’s clothes',
'clothing woman woman s clothes fashion shopping bags female'
],[
'🪭',
'folding hand fan',
'cooling dance flutter folding hand fan hot shy buchaechum nihon buyō maranao'
],[
'👛',
'purse',
'clothing coin fashion accessories money sales shopping'
],[
'👜',
'handbag',
'bag clothing purse fashion accessory accessories shopping'
],[
'👝',
'clutch bag',
'bag clothing pouch accessories shopping'
],[
'🛍️',
'shopping bags',
'bag hotel shopping mall buy purchase'
],[
'🎒',
'backpack',
'bag rucksack satchel school student education'
],[
'🩴',
'thong sandal',
'beach sandals sandals thong sandals thongs zōri footwear summer'
],[
'👞',
'man’s shoe',
'clothing man shoe man s shoe fashion male'
],[
'👟',
'running shoe',
'athletic clothing shoe sneaker shoes sports sneakers'
],[
'🥾',
'hiking boot',
'backpacking boot camping hiking'
],[
'🥿',
'flat shoe',
'ballet flat slip-on slipper ballet'
],[
'👠',
'high-heeled shoe',
'clothing heel shoe woman high heeled shoe fashion shoes female pumps stiletto'
],[
'👡',
'woman’s sandal',
'clothing sandal shoe woman woman s sandal shoes fashion flip flops'
],[
'🩰',
'ballet shoes',
'ballet dance'
],[
'👢',
'woman’s boot',
'boot clothing shoe woman woman s boot shoes fashion'
],[
'🪮',
'hair pick',
'afro comb hair pick curly'
],[
'👑',
'crown',
'clothing king queen kod leader royalty lord'
],[
'👒',
'woman’s hat',
'clothing hat woman woman s hat fashion accessories female lady spring'
],[
'🎩',
'top hat',
'clothing hat top tophat magic gentleman classy circus'
],[
'🎓',
'graduation cap',
'cap celebration clothing graduation hat school college degree university legal learn education'
],[
'🧢',
'billed cap',
'baseball cap cap baseball'
],[
'🪖',
'military helmet',
'army helmet military soldier warrior protection'
],[
'⛑️',
'rescue worker’s helmet',
'aid cross face hat helmet rescue worker s helmet construction build'
],[
'📿',
'prayer beads',
'beads clothing necklace prayer religion dhikr religious'
],[
'💄',
'lipstick',
'cosmetics makeup female girl fashion woman'
],[
'💍',
'ring',
'diamond wedding propose marriage valentines fashion jewelry gem engagement'
],[
'💎',
'gem stone',
'diamond gem jewel blue ruby jewelry'
],[
'🔇',
'muted speaker',
'mute quiet silent speaker sound volume silence'
],[
'🔈',
'speaker low volume',
'soft sound volume silence broadcast'
],[
'🔉',
'speaker medium volume',
'medium volume speaker broadcast'
],[
'🔊',
'speaker high volume',
'loud volume noise noisy speaker broadcast'
],[
'📢',
'loudspeaker',
'loud public address volume sound'
],[
'📣',
'megaphone',
'cheering sound speaker volume'
],[
'📯',
'postal horn',
'horn post postal instrument music'
],[
'🔔',
'bell',
'sound notification christmas xmas chime'
],[
'🔕',
'bell with slash',
'bell forbidden mute quiet silent sound volume'
],[
'🎼',
'musical score',
'music score treble clef compose'
],[
'🎵',
'musical note',
'music note score tone sound'
],[
'🎶',
'musical notes',
'music note notes score'
],[
'🎙️',
'studio microphone',
'mic microphone music studio sing recording artist talkshow'
],[
'🎚️',
'level slider',
'level music slider scale'
],[
'🎛️',
'control knobs',
'control knobs music dial'
],[
'🎤',
'microphone',
'karaoke mic sound music PA sing talkshow'
],[
'🎧',
'headphone',
'earbud music score gadgets'
],[
'📻',
'radio',
'video communication music podcast program'
],[
'🎷',
'saxophone',
'instrument music sax jazz blues'
],[
'🪗',
'accordion',
'accordian concertina squeeze box music'
],[
'🎸',
'guitar',
'instrument music'
],[
'🎹',
'musical keyboard',
'instrument keyboard music piano compose'
],[
'🎺',
'trumpet',
'instrument music brass'
],[
'🎻',
'violin',
'instrument music orchestra symphony'
],[
'🪕',
'banjo',
'music stringed instructment'
],[
'🥁',
'drum',
'drumsticks music instrument snare'
],[
'🪘',
'long drum',
'beat conga drum rhythm music'
],[
'🪇',
'maracas',
'instrument maracas music percussion rattle shake'
],[
'🪈',
'flute',
'fife flute music pipe recorder woodwind'
],[
'🪉',
'harp',
'cupid harp instrument love music orchestra'
],[
'📱',
'mobile phone',
'cell mobile phone telephone technology apple gadgets dial'
],[
'📲',
'mobile phone with arrow',
'arrow cell mobile phone receive iphone incoming'
],[
'☎️',
'telephone',
'phone technology communication dial'
],[
'📞',
'telephone receiver',
'phone receiver telephone technology communication dial'
],[
'📟',
'pager',
'bbcall oldschool 90s'
],[
'📠',
'fax machine',
'fax communication technology'
],[
'🔋',
'battery',
'power energy sustain'
],[
'🪫',
'low battery',
'electronic power low energy drained empty'
],[
'🔌',
'electric plug',
'electric electricity plug charger power'
],[
'💻',
'laptop',
'computer pc personal technology screen display monitor'
],[
'🖥️',
'desktop computer',
'computer desktop technology computing screen'
],[
'🖨️',
'printer',
'computer paper ink'
],[
'⌨️',
'keyboard',
'computer technology type input text'
],[
'🖱️',
'computer mouse',
'computer click'
],[
'🖲️',
'trackball',
'computer technology trackpad'
],[
'💽',
'computer disk',
'computer disk minidisk optical technology record data 90s'
],[
'💾',
'floppy disk',
'computer disk floppy oldschool technology save 90s 80s'
],[
'💿',
'optical disk',
'cd computer disk optical technology dvd disc 90s'
],[
'📀',
'dvd',
'blu-ray computer disk optical cd disc'
],[
'🧮',
'abacus',
'calculation'
],[
'🎥',
'movie camera',
'camera cinema movie film record'
],[
'🎞️',
'film frames',
'cinema film frames movie'
],[
'📽️',
'film projector',
'cinema film movie projector video tape record'
],[
'🎬',
'clapper board',
'clapper movie film record'
],[
'📺',
'television',
'tv video technology program oldschool show'
],[
'📷',
'camera',
'video gadgets photography'
],[
'📸',
'camera with flash',
'camera flash video photography gadgets'
],[
'📹',
'video camera',
'camera video film record'
],[
'📼',
'videocassette',
'tape vhs video record oldschool 90s 80s'
],[
'🔍',
'magnifying glass tilted left',
'glass magnifying search tool zoom find detective'
],[
'🔎',
'magnifying glass tilted right',
'glass magnifying search tool zoom find detective'
],[
'🕯️',
'candle',
'light fire wax'
],[
'💡',
'light bulb',
'bulb comic electric idea light electricity'
],[
'🔦',
'flashlight',
'electric light tool torch dark camping sight night'
],[
'🏮',
'red paper lantern',
'bar lantern light red paper halloween spooky'
],[
'🪔',
'diya lamp',
'diya lamp oil lighting'
],[
'📔',
'notebook with decorative cover',
'book cover decorated notebook classroom notes record paper study'
],[
'📕',
'closed book',
'book closed read library knowledge textbook learn'
],[
'📖',
'open book',
'book open read library knowledge literature learn study'
],[
'📗',
'green book',
'book green read library knowledge study'
],[
'📘',
'blue book',
'blue book read library knowledge learn study'
],[
'📙',
'orange book',
'book orange read library knowledge textbook study'
],[
'📚',
'books',
'book literature library study'
],[
'📓',
'notebook',
'stationery record notes paper study'
],[
'📒',
'ledger',
'notebook notes paper'
],[
'📃',
'page with curl',
'curl document page documents office paper'
],[
'📜',
'scroll',
'paper documents ancient history'
],[
'📄',
'page facing up',
'document page documents office paper information'
],[
'📰',
'newspaper',
'news paper press headline'
],[
'🗞️',
'rolled-up newspaper',
'news newspaper paper rolled rolled up newspaper press headline'
],[
'📑',
'bookmark tabs',
'bookmark mark marker tabs favorite save order tidy'
],[
'🔖',
'bookmark',
'mark favorite label save'
],[
'🏷️',
'label',
'sale tag'
],[
'💰',
'money bag',
'bag dollar money moneybag payment coins sale'
],[
'🪙',
'coin',
'gold metal money silver treasure currency'
],[
'💴',
'yen banknote',
'banknote bill currency money note yen sales japanese dollar'
],[
'💵',
'dollar banknote',
'banknote bill currency dollar money note sales'
],[
'💶',
'euro banknote',
'banknote bill currency euro money note sales dollar'
],[
'💷',
'pound banknote',
'banknote bill currency money note pound british sterling sales bills uk england'
],[
'💸',
'money with wings',
'banknote bill fly money wings dollar bills payment sale'
],[
'💳',
'credit card',
'card credit money sales dollar bill payment shopping'
],[
'🧾',
'receipt',
'accounting bookkeeping evidence proof expenses'
],[
'💹',
'chart increasing with yen',
'chart graph growth money yen green-square presentation stats'
],[
'✉️',
'envelope',
'email letter postal inbox communication'
],[
'📧',
'e-mail',
'email letter mail e mail communication inbox'
],[
'📨',
'incoming envelope',
'e-mail email envelope incoming letter receive inbox'
],[
'📩',
'envelope with arrow',
'arrow e-mail email envelope outgoing communication'
],[
'📤',
'outbox tray',
'box letter mail outbox sent tray inbox email'
],[
'📥',
'inbox tray',
'box inbox letter mail receive tray email documents'
],[
'📦',
'package',
'box parcel mail gift cardboard moving'
],[
'📫',
'closed mailbox with raised flag',
'closed mail mailbox postbox email inbox communication'
],[
'📪',
'closed mailbox with lowered flag',
'closed lowered mail mailbox postbox email communication inbox'
],[
'📬',
'open mailbox with raised flag',
'mail mailbox open postbox email inbox communication'
],[
'📭',
'open mailbox with lowered flag',
'lowered mail mailbox open postbox email inbox'
],[
'📮',
'postbox',
'mail mailbox email letter envelope'
],[
'🗳️',
'ballot box with ballot',
'ballot box election vote'
],[
'✏️',
'pencil',
'stationery write paper writing school study'
],[
'✒️',
'black nib',
'nib pen stationery writing write'
],[
'🖋️',
'fountain pen',
'fountain pen stationery writing write'
],[
'🖊️',
'pen',
'ballpoint stationery writing write'
],[
'🖌️',
'paintbrush',
'painting drawing creativity art'
],[
'🖍️',
'crayon',
'drawing creativity'
],[
'📝',
'memo',
'pencil write documents stationery paper writing legal exam quiz test study compose'
],[
'💼',
'briefcase',
'business documents work law legal job career'
],[
'📁',
'file folder',
'file folder documents business office'
],[
'📂',
'open file folder',
'file folder open documents load'
],[
'🗂️',
'card index dividers',
'card dividers index organizing business stationery'
],[
'📅',
'calendar',
'date schedule'
],[
'📆',
'tear-off calendar',
'calendar tear off calendar schedule date planning'
],[
'🗒️',
'spiral notepad',
'note pad spiral memo stationery'
],[
'🗓️',
'spiral calendar',
'calendar pad spiral date schedule planning'
],[
'📇',
'card index',
'card index rolodex business stationery'
],[
'📈',
'chart increasing',
'chart graph growth trend upward presentation stats recovery business economics money sales good success'
],[
'📉',
'chart decreasing',
'chart down graph trend presentation stats recession business economics money sales bad failure'
],[
'📊',
'bar chart',
'bar chart graph presentation stats'
],[
'📋',
'clipboard',
'stationery documents'
],[
'📌',
'pushpin',
'pin stationery mark here'
],[
'📍',
'round pushpin',
'pin pushpin stationery location map here'
],[
'📎',
'paperclip',
'documents stationery'
],[
'🖇️',
'linked paperclips',
'link paperclip documents stationery'
],[
'📏',
'straight ruler',
'ruler straight edge stationery calculate length math school drawing architect sketch'
],[
'📐',
'triangular ruler',
'ruler set triangle stationery math architect sketch'
],[
'✂️',
'scissors',
'cutting tool stationery cut'
],[
'🗃️',
'card file box',
'box card file business stationery'
],[
'🗄️',
'file cabinet',
'cabinet file filing organizing'
],[
'🗑️',
'wastebasket',
'bin trash rubbish garbage toss'
],[
'🔒',
'locked',
'closed security password padlock'
],[
'🔓',
'unlocked',
'lock open unlock privacy security'
],[
'🔏',
'locked with pen',
'ink lock nib pen privacy security secret'
],[
'🔐',
'locked with key',
'closed key lock secure security privacy'
],[
'🔑',
'key',
'lock password door'
],[
'🗝️',
'old key',
'clue key lock old door password'
],[
'🔨',
'hammer',
'tool tools build create'
],[
'🪓',
'axe',
'chop hatchet split wood tool cut'
],[
'⛏️',
'pick',
'mining tool tools dig'
],[
'⚒️',
'hammer and pick',
'hammer pick tool tools build create'
],[
'🛠️',
'hammer and wrench',
'hammer spanner tool wrench tools build create'
],[
'🗡️',
'dagger',
'knife weapon'
],[
'⚔️',
'crossed swords',
'crossed swords weapon'
],[
'💣',
'bomb',
'comic boom explode explosion terrorism'
],[
'🪃',
'boomerang',
'australia rebound repercussion weapon'
],[
'🏹',
'bow and arrow',
'archer arrow bow Sagittarius zodiac sports'
],[
'🛡️',
'shield',
'weapon protection security'
],[
'🪚',
'carpentry saw',
'carpenter lumber saw tool cut chop'
],[
'🔧',
'wrench',
'spanner tool tools diy ikea fix maintainer'
],[
'🪛',
'screwdriver',
'screw tool tools'
],[
'🔩',
'nut and bolt',
'bolt nut tool handy tools fix'
],[
'⚙️',
'gear',
'cog cogwheel tool'
],[
'🗜️',
'clamp',
'compress tool vice'
],[
'⚖️',
'balance scale',
'balance justice Libra scale zodiac law fairness weight'
],[
'🦯',
'white cane',
'accessibility blind probing cane'
],[
'🔗',
'link',
'chain rings url hyperlink'
],[
'⛓️‍💥',
'broken chain',
'breaking broken chain cuffs freedom'
],[
'⛓️',
'chains',
'chain lock arrest'
],[
'🪝',
'hook',
'catch crook curve ensnare selling point tools'
],[
'🧰',
'toolbox',
'chest mechanic tool tools diy fix maintainer'
],[
'🧲',
'magnet',
'attraction horseshoe magnetic'
],[
'🪜',
'ladder',
'climb rung step tools'
],[
'🪏',
'shovel',
'bury dig garden hole plant scoop shovel snow spade'
],[
'⚗️',
'alembic',
'chemistry tool distilling science experiment'
],[
'🧪',
'test tube',
'chemist chemistry experiment lab science'
],[
'🧫',
'petri dish',
'bacteria biologist biology culture lab'
],[
'🧬',
'dna',
'biologist evolution gene genetics life'
],[
'🔬',
'microscope',
'science tool laboratory experiment zoomin study'
],[
'🔭',
'telescope',
'science tool stars space zoom astronomy'
],[
'📡',
'satellite antenna',
'antenna dish satellite communication future radio space'
],[
'💉',
'syringe',
'medicine needle shot sick health hospital drugs blood doctor nurse'
],[
'🩸',
'drop of blood',
'bleed blood donation injury medicine menstruation period hurt harm wound'
],[
'💊',
'pill',
'doctor medicine sick health pharmacy drug'
],[
'🩹',
'adhesive bandage',
'bandage heal'
],[
'🩼',
'crutch',
'cane disability hurt mobility aid stick'
],[
'🩺',
'stethoscope',
'doctor heart medicine health'
],[
'🩻',
'x-ray',
'bones doctor medical skeleton'
],[
'🚪',
'door',
'house entry exit'
],[
'🛗',
'elevator',
'accessibility hoist lift'
],[
'🪞',
'mirror',
'reflection reflector speculum'
],[
'🪟',
'window',
'frame fresh air opening transparent view scenery'
],[
'🛏️',
'bed',
'hotel sleep rest'
],[
'🛋️',
'couch and lamp',
'couch hotel lamp read chill'
],[
'🪑',
'chair',
'seat sit furniture'
],[
'🚽',
'toilet',
'restroom wc washroom bathroom potty'
],[
'🪠',
'plunger',
'force cup plumber suction toilet'
],[
'🚿',
'shower',
'water clean bathroom'
],[
'🛁',
'bathtub',
'bath clean shower bathroom'
],[
'🪤',
'mouse trap',
'bait mousetrap snare trap cheese'
],[
'🪒',
'razor',
'sharp shave cut'
],[
'🧴',
'lotion bottle',
'lotion moisturizer shampoo sunscreen'
],[
'🧷',
'safety pin',
'diaper punk rock'
],[
'🧹',
'broom',
'cleaning sweeping witch'
],[
'🧺',
'basket',
'farming laundry picnic'
],[
'🧻',
'roll of paper',
'paper towels toilet paper roll'
],[
'🪣',
'bucket',
'cask pail vat water container'
],[
'🧼',
'soap',
'bar bathing cleaning lather soapdish'
],[
'🫧',
'bubbles',
'burp clean soap underwater'
],[
'🪥',
'toothbrush',
'bathroom brush clean dental hygiene teeth'
],[
'🧽',
'sponge',
'absorbing cleaning porous'
],[
'🧯',
'fire extinguisher',
'extinguish fire quench'
],[
'🛒',
'shopping cart',
'cart shopping trolley'
],[
'🚬',
'cigarette',
'smoking kills tobacco joint smoke'
],[
'⚰️',
'coffin',
'death vampire dead die rip graveyard cemetery casket funeral box'
],[
'🪦',
'headstone',
'cemetery grave graveyard tombstone death rip'
],[
'⚱️',
'funeral urn',
'ashes death funeral urn dead die rip'
],[
'🧿',
'nazar amulet',
'bead charm evil-eye nazar talisman'
],[
'🪬',
'hamsa',
'amulet Fatima hand Mary Miriam protection'
],[
'🗿',
'moai',
'face moyai statue rock easter island'
],[
'🪧',
'placard',
'demonstration picket protest sign announcement'
],[
'🪪',
'identification card',
'credentials ID license security'
],



// Symbols
[
'🏧',
'ATM sign',
'atm automated bank teller atm sign money sales cash blue-square payment'
],[
'🚮',
'litter in bin sign',
'litter litter bin blue-square sign human info'
],[
'🚰',
'potable water',
'drinking potable water blue-square liquid restroom cleaning faucet'
],[
'♿',
'wheelchair symbol',
'access blue-square disabled accessibility'
],[
'🚹',
'men’s room',
'lavatory man restroom wc men s room toilet blue-square gender male'
],[
'🚺',
'women’s room',
'lavatory restroom wc woman women s room purple-square female toilet loo gender'
],[
'🚻',
'restroom',
'lavatory WC blue-square toilet refresh wc gender'
],[
'🚼',
'baby symbol',
'baby changing orange-square child'
],[
'🚾',
'water closet',
'closet lavatory restroom water wc toilet blue-square'
],[
'🛂',
'passport control',
'control passport custom blue-square'
],[
'🛃',
'customs',
'passport border blue-square'
],[
'🛄',
'baggage claim',
'baggage claim blue-square airport transport'
],[
'🛅',
'left luggage',
'baggage locker luggage blue-square travel'
],[
'⚠️',
'warning',
'exclamation wip alert error problem issue'
],[
'🚸',
'children crossing',
'child crossing pedestrian traffic school warning danger sign driving yellow-diamond'
],[
'⛔',
'no entry',
'entry forbidden no not prohibited traffic limit security privacy bad denied stop circle'
],[
'🚫',
'prohibited',
'entry forbidden no not forbid stop limit denied disallow circle'
],[
'🚳',
'no bicycles',
'bicycle bike forbidden no prohibited cyclist circle'
],[
'🚭',
'no smoking',
'forbidden no not prohibited smoking cigarette blue-square smell smoke'
],[
'🚯',
'no littering',
'forbidden litter no not prohibited trash bin garbage circle'
],[
'🚱',
'non-potable water',
'non-drinking non-potable water non potable water drink faucet tap circle'
],[
'🚷',
'no pedestrians',
'forbidden no not pedestrian prohibited rules crossing walking circle'
],[
'📵',
'no mobile phones',
'cell forbidden mobile no phone iphone mute circle'
],[
'🔞',
'no one under eighteen',
'18 age restriction eighteen prohibited underage drink pub night minor circle'
],[
'☢️',
'radioactive',
'sign nuclear danger'
],[
'☣️',
'biohazard',
'sign danger'
],[
'⬆️',
'up arrow',
'arrow cardinal direction north blue-square continue top'
],[
'↗️',
'up-right arrow',
'arrow direction intercardinal northeast up right arrow blue-square point diagonal'
],[
'➡️',
'right arrow',
'arrow cardinal direction east blue-square next'
],[
'↘️',
'down-right arrow',
'arrow direction intercardinal southeast down right arrow blue-square diagonal'
],[
'⬇️',
'down arrow',
'arrow cardinal direction down south blue-square bottom'
],[
'↙️',
'down-left arrow',
'arrow direction intercardinal southwest down left arrow blue-square diagonal'
],[
'⬅️',
'left arrow',
'arrow cardinal direction west blue-square previous back'
],[
'↖️',
'up-left arrow',
'arrow direction intercardinal northwest up left arrow blue-square point diagonal'
],[
'↕️',
'up-down arrow',
'arrow up down arrow blue-square direction way vertical'
],[
'↔️',
'left-right arrow',
'arrow left right arrow shape direction horizontal sideways'
],[
'↩️',
'right arrow curving left',
'arrow back return blue-square undo enter'
],[
'↪️',
'left arrow curving right',
'arrow blue-square return rotate direction'
],[
'⤴️',
'right arrow curving up',
'arrow blue-square direction top'
],[
'⤵️',
'right arrow curving down',
'arrow down blue-square direction bottom'
],[
'🔃',
'clockwise vertical arrows',
'arrow clockwise reload sync cycle round repeat'
],[
'🔄',
'counterclockwise arrows button',
'anticlockwise arrow counterclockwise withershins blue-square sync cycle'
],[
'🔙',
'BACK arrow',
'arrow back back arrow words return'
],[
'🔚',
'END arrow',
'arrow end end arrow words'
],[
'🔛',
'ON! arrow',
'arrow mark on on arrow words'
],[
'🔜',
'SOON arrow',
'arrow soon soon arrow words'
],[
'🔝',
'TOP arrow',
'arrow top up top arrow words blue-square'
],[
'🛐',
'place of worship',
'religion worship church temple prayer'
],[
'⚛️',
'atom symbol',
'atheist atom science physics chemistry'
],[
'🕉️',
'om',
'Hindu religion hinduism buddhism sikhism jainism'
],[
'✡️',
'star of David',
'David Jew Jewish religion star star of david judaism'
],[
'☸️',
'wheel of dharma',
'Buddhist dharma religion wheel hinduism buddhism sikhism jainism'
],[
'☯️',
'yin yang',
'religion tao taoist yang yin balance'
],[
'✝️',
'latin cross',
'Christian cross religion christianity'
],[
'☦️',
'orthodox cross',
'Christian cross religion suppedaneum'
],[
'☪️',
'star and crescent',
'islam Muslim religion'
],[
'☮️',
'peace symbol',
'peace hippie'
],[
'🕎',
'menorah',
'candelabrum candlestick religion hanukkah candles jewish'
],[
'🔯',
'dotted six-pointed star',
'fortune star dotted six pointed star purple-square religion jewish hexagram'
],[
'🪯',
'khanda',
'khanda religion Sikh'
],[
'♈',
'Aries',
'ram zodiac aries sign purple-square astrology'
],[
'♉',
'Taurus',
'bull ox zodiac taurus purple-square sign astrology'
],[
'♊',
'Gemini',
'twins zodiac gemini sign purple-square astrology'
],[
'♋',
'Cancer',
'crab zodiac cancer sign purple-square astrology'
],[
'♌',
'Leo',
'lion zodiac leo sign purple-square astrology'
],[
'♍',
'Virgo',
'zodiac virgo sign purple-square astrology'
],[
'♎',
'Libra',
'balance justice scales zodiac libra sign purple-square astrology'
],[
'♏',
'Scorpio',
'scorpion scorpius zodiac scorpio sign purple-square astrology'
],[
'♐',
'Sagittarius',
'archer zodiac sagittarius sign purple-square astrology'
],[
'♑',
'Capricorn',
'goat zodiac capricorn sign purple-square astrology'
],[
'♒',
'Aquarius',
'bearer water zodiac aquarius sign purple-square astrology'
],[
'♓',
'Pisces',
'fish zodiac pisces purple-square sign astrology'
],[
'⛎',
'Ophiuchus',
'bearer serpent snake zodiac ophiuchus sign purple-square constellation astrology'
],[
'🔀',
'shuffle tracks button',
'arrow crossed blue-square shuffle music random'
],[
'🔁',
'repeat button',
'arrow clockwise repeat loop record'
],[
'🔂',
'repeat single button',
'arrow clockwise once blue-square loop'
],[
'▶️',
'play button',
'arrow play right triangle blue-square direction'
],[
'⏩',
'fast-forward button',
'arrow double fast forward fast forward button blue-square play speed continue'
],[
'⏭️',
'next track button',
'arrow next scene next track triangle forward next blue-square'
],[
'⏭️',
'play or pause button',
'arrow pause play right triangle blue-square'
],[
'◀️',
'reverse button',
'arrow left reverse triangle blue-square direction'
],[
'⏪',
'fast reverse button',
'arrow double rewind play blue-square'
],[
'⏮️',
'last track button',
'arrow previous scene previous track triangle backward'
],[
'🔼',
'upwards button',
'arrow button red blue-square triangle direction point forward top'
],[
'⏫',
'fast up button',
'arrow double blue-square direction top'
],[
'🔽',
'downwards button',
'arrow button down red blue-square direction bottom'
],[
'⏬',
'fast down button',
'arrow double down blue-square direction bottom'
],[
'⏸️',
'pause button',
'bar double pause vertical blue-square'
],[
'⏹️',
'stop button',
'square stop blue-square'
],[
'⏺️',
'record button',
'circle record blue-square'
],[
'⏏️',
'eject button',
'eject blue-square'
],[
'🎦',
'cinema',
'camera film movie blue-square record curtain stage theater'
],[
'🔅',
'dim button',
'brightness dim low sun afternoon warm summer'
],[
'🔆',
'bright button',
'bright brightness sun light'
],[
'📶',
'antenna bars',
'antenna bar cell mobile phone blue-square reception internet connection wifi bluetooth bars'
],[
'🛜',
'wireless',
'computer internet network wi-fi wifi wireless connection'
],[
'📳',
'vibration mode',
'cell mobile mode phone telephone vibration orange-square'
],[
'📴',
'mobile phone off',
'cell mobile off phone telephone mute orange-square silence quiet'
],[
'♀️',
'female sign',
'woman women lady girl'
],[
'♂️',
'male sign',
'man boy men'
],[
'⚧️',
'transgender symbol',
'transgender lgbtq'
],[
'✖️',
'multiply',
'× cancel multiplication sign x multiplication sign math calculation'
],[
'➕',
'plus',
'+ math sign plus sign calculation addition more increase'
],[
'➖',
'minus',
'- − math sign minus sign calculation subtract less'
],[
'➗',
'divide',
'÷ division math sign division sign calculation'
],[
'🟰',
'heavy equals sign',
'equality math equation'
],[
'♾️',
'infinity',
'forever unbounded universal'
],[
'‼️',
'double exclamation mark',
'! !! bangbang exclamation mark surprise'
],[
'⁉️',
'exclamation question mark',
'! !? ? exclamation interrobang mark punctuation question wat surprise'
],[
'❓',
'red question mark',
'? mark punctuation question question mark doubt confused'
],[
'❔',
'white question mark',
'? mark outlined punctuation question doubts gray huh confused'
],[
'❕',
'white exclamation mark',
'! exclamation mark outlined punctuation surprise gray wow warning'
],[
'❗',
'red exclamation mark',
'! exclamation mark punctuation exclamation mark heavy exclamation mark danger surprise wow warning'
],[
'〰️',
'wavy dash',
'dash punctuation wavy draw line moustache mustache squiggle scribble'
],[
'💱',
'currency exchange',
'bank currency exchange money sales dollar travel'
],[
'💲',
'heavy dollar sign',
'currency dollar money sales payment buck'
],[
'⚕️',
'medical symbol',
'aesculapius medicine staff health hospital'
],[
'♻️',
'recycling symbol',
'recycle arrow environment garbage trash'
],[
'⚜️',
'fleur-de-lis',
'fleur de lis decorative scout'
],[
'🔱',
'trident emblem',
'anchor emblem ship tool trident weapon spear'
],[
'📛',
'name badge',
'badge name fire forbid'
],[
'🔰',
'Japanese symbol for beginner',
'beginner chevron Japanese leaf japanese symbol for beginner badge shield'
],[
'⭕',
'hollow red circle',
'circle large o red round'
],[
'✅',
'check mark button',
'✓ button check mark green-square ok agree vote election answer tick'
],[
'☑️',
'check box with check',
'✓ box check ok agree confirm black-square vote election yes tick'
],[
'✔️',
'check mark',
'✓ check mark ok nike answer yes tick'
],[
'❌',
'cross mark',
'× cancel cross mark multiplication multiply x no delete remove red'
],[
'❎',
'cross mark button',
'× mark square x green-square no deny'
],[
'➰',
'curly loop',
'curl loop scribble draw shape squiggle'
],[
'➿',
'double curly loop',
'curl double loop tape cassette'
],[
'〽️',
'part alternation mark',
'mark part graph presentation stats business economics bad'
],[
'✳️',
'eight-spoked asterisk',
'* asterisk eight spoked asterisk star sparkle green-square'
],[
'✴️',
'eight-pointed star',
'* star eight pointed star orange-square shape polygon'
],[
'❇️',
'sparkle',
'* stars green-square awesome good fireworks'
],[
'©️',
'copyright',
'c ip license circle law legal'
],[
'®️',
'registered',
'r alphabet circle'
],[
'™️',
'trade mark',
'mark tm trademark brand law legal'
],[
'🫟',
'splatter',
'drip holi ink liquid mess paint spill stain'
],[
'#️⃣',
'keycap: #',
'keycap keycap  symbol blue-square twitter'
],[
'*️⃣',
'keycap: *',
'keycap keycap  star'
],[
'0️⃣',
'keycap: 0',
'keycap keycap 0 0 numbers blue-square null'
],[
'1️⃣',
'keycap: 1',
'keycap keycap 1 blue-square numbers 1'
],[
'2️⃣',
'keycap: 2',
'keycap keycap 2 numbers 2 prime blue-square'
],[
'3️⃣',
'keycap: 3',
'keycap keycap 3 3 numbers prime blue-square'
],[
'4️⃣',
'keycap: 4',
'keycap keycap 4 4 numbers blue-square'
],[
'5️⃣',
'keycap: 5',
'keycap keycap 5 5 numbers blue-square prime'
],[
'6️⃣',
'keycap: 6',
'keycap keycap 6 6 numbers blue-square'
],[
'7️⃣',
'keycap: 7',
'keycap keycap 7 7 numbers blue-square prime'
],[
'8️⃣',
'keycap: 8',
'keycap keycap 8 8 blue-square numbers'
],[
'9️⃣',
'keycap: 9',
'keycap keycap 9 blue-square numbers 9'
],[
'🔟',
'keycap: 10',
'keycap keycap 10 numbers 10 blue-square'
],[
'🔠',
'input latin uppercase',
'ABCD input latin letters uppercase alphabet words blue-square'
],[
'🔡',
'input latin lowercase',
'abcd input latin letters lowercase blue-square alphabet'
],[
'🔢',
'input numbers',
'1234 input numbers blue-square'
],[
'🔣',
'input symbols',
'〒♪&% input blue-square music note ampersand percent glyphs characters'
],[
'🔤',
'input latin letters',
'abc alphabet input latin letters blue-square'
],[
'🅰️',
'A button (blood type)',
'a blood type a button red-square alphabet letter'
],[
'🆎',
'AB button (blood type)',
'ab blood type ab button red-square alphabet'
],[
'🅱️',
'B button (blood type)',
'b blood type b button red-square alphabet letter'
],[
'🆑',
'CL button',
'cl cl button alphabet words red-square'
],[
'🆒',
'COOL button',
'cool cool button words blue-square'
],[
'🆓',
'FREE button',
'free free button blue-square words'
],[
'ℹ️',
'information',
'i blue-square alphabet letter'
],[
'🆔',
'ID button',
'id identity id button purple-square words'
],[
'Ⓜ️',
'circled M',
'circle m circled m alphabet blue-circle letter'
],[
'🆕',
'NEW button',
'new new button blue-square words start'
],[
'🆖',
'NG button',
'ng ng button blue-square words shape icon'
],[
'🅾️',
'O button (blood type)',
'blood type o o button alphabet red-square letter'
],[
'🆗',
'OK button',
'OK ok button good agree yes blue-square'
],[
'🅿️',
'P button',
'parking p button cars blue-square alphabet letter'
],[
'🆘',
'SOS button',
'help sos sos button red-square words emergency 911'
],[
'🆙',
'UP! button',
'mark up up button blue-square above high'
],[
'🆚',
'VS button',
'versus vs vs button words orange-square'
],[
'🈁',
'Japanese “here” button',
'“here” Japanese katakana ココ japanese here button blue-square here japanese destination'
],[
'🈂️',
'Japanese “service charge” button',
'“service charge” Japanese katakana サ japanese service charge button japanese blue-square'
],[
'🈷️',
'Japanese “monthly amount” button',
'“monthly amount” ideograph Japanese 月 japanese monthly amount button chinese month moon japanese orange-square kanji'
],[
'🈶',
'Japanese “not free of charge” button',
'“not free of charge” ideograph Japanese 有 japanese not free of charge button orange-square chinese have kanji'
],[
'🈯',
'Japanese “reserved” button',
'“reserved” ideograph Japanese 指 japanese reserved button chinese point green-square kanji'
],[
'🉐',
'Japanese “bargain” button',
'“bargain” ideograph Japanese 得 japanese bargain button chinese kanji obtain get circle'
],[
'🈹',
'Japanese “discount” button',
'“discount” ideograph Japanese 割 japanese discount button cut divide chinese kanji pink-square'
],[
'🈚',
'Japanese “free of charge” button',
'“free of charge” ideograph Japanese 無 japanese free of charge button nothing chinese kanji japanese orange-square'
],[
'🈲',
'Japanese “prohibited” button',
'“prohibited” ideograph Japanese 禁 japanese prohibited button kanji japanese chinese forbidden limit restricted red-square'
],[
'🉑',
'Japanese “acceptable” button',
'“acceptable” ideograph Japanese 可 japanese acceptable button ok good chinese kanji agree yes orange-circle'
],[
'🈸',
'Japanese “application” button',
'“application” ideograph Japanese 申 japanese application button chinese japanese kanji orange-square'
],[
'🈴',
'Japanese “passing grade” button',
'“passing grade” ideograph Japanese 合 japanese passing grade button japanese chinese join kanji red-square'
],[
'🈳',
'Japanese “vacancy” button',
'“vacancy” ideograph Japanese 空 japanese vacancy button kanji japanese chinese empty sky blue-square'
],[
'㊗️',
'Japanese “congratulations” button',
'“congratulations” ideograph Japanese 祝 japanese congratulations button chinese kanji japanese red-circle'
],[
'㊙️',
'Japanese “secret” button',
'“secret” ideograph Japanese 秘 japanese secret button privacy chinese sshh kanji red-circle'
],[
'🈺',
'Japanese “open for business” button',
'“open for business” ideograph Japanese 営 japanese open for business button japanese opening hours orange-square'
],[
'🈵',
'Japanese “no vacancy” button',
'“no vacancy” ideograph Japanese 満 japanese no vacancy button full chinese japanese red-square kanji'
],[
'🔴',
'red circle',
'circle geometric red shape error danger'
],[
'🟠',
'orange circle',
'circle orange round'
],[
'🟡',
'yellow circle',
'circle yellow round'
],[
'🟢',
'green circle',
'circle green round'
],[
'🔵',
'blue circle',
'blue circle geometric shape icon button'
],[
'🟣',
'purple circle',
'circle purple round'
],[
'🟤',
'brown circle',
'brown circle round'
],[
'⚫',
'black circle',
'circle geometric shape button round'
],[
'⚪',
'white circle',
'circle geometric shape round'
],[
'🟥',
'red square',
'red square'
],[
'🟧',
'orange square',
'orange square'
],[
'🟨',
'yellow square',
'square yellow'
],[
'🟩',
'green square',
'green square'
],[
'🟦',
'blue square',
'blue square'
],[
'🟪',
'purple square',
'purple square'
],[
'🟫',
'brown square',
'brown square'
],[
'⬛',
'black large square',
'geometric square shape icon button'
],[
'⬜',
'white large square',
'geometric square shape icon stone button'
],[
'◼️',
'black medium square',
'geometric square shape button icon'
],[
'◻️',
'white medium square',
'geometric square shape stone icon'
],[
'◾',
'black medium-small square',
'geometric square black medium small square icon shape button'
],[
'◽',
'white medium-small square',
'geometric square white medium small square shape stone icon button'
],[
'▪️',
'black small square',
'geometric square shape icon'
],[
'▫️',
'white small square',
'geometric square shape icon'
],[
'🔶',
'large orange diamond',
'diamond geometric orange shape jewel gem'
],[
'🔷',
'large blue diamond',
'blue diamond geometric shape jewel gem'
],[
'🔸',
'small orange diamond',
'diamond geometric orange shape jewel gem'
],[
'🔹',
'small blue diamond',
'blue diamond geometric shape jewel gem'
],[
'🔺',
'red triangle pointed up',
'geometric red shape direction up top'
],[
'🔻',
'red triangle pointed down',
'down geometric red shape direction bottom'
],[
'💠',
'diamond with a dot',
'comic diamond geometric inside jewel blue gem crystal fancy'
],[
'🔘',
'radio button',
'button geometric radio input old music circle'
],[
'🔳',
'white square button',
'button geometric outlined square shape input'
],[
'🔲',
'black square button',
'button geometric square shape input frame'
],



// Flags
[
'🏁',
'chequered flag',
'checkered chequered racing contest finishline race gokart'
],[
'🚩',
'triangular flag',
'post mark milestone place'
],[
'🎌',
'crossed flags',
'celebration cross crossed Japanese japanese nation country border'
],[
'🏴',
'black flag',
'waving pirate'
],[
'🏳️',
'white flag',
'waving losing loser lost surrender give up fail'
],[
'🏳️‍🌈',
'rainbow flag',
'pride rainbow flag gay lgbt glbt queer homosexual lesbian bisexual transgender'
],[
'🏳️‍⚧️',
'transgender flag',
'flag light blue pink transgender white lgbtq'
],[
'🏴‍☠️',
'pirate flag',
'Jolly Roger pirate plunder treasure skull crossbones flag banner'
],[
'🇦🇨',
'flag: Ascension Island',
'flag flag ascension island'
],[
'🇦🇩',
'flag: Andorra',
'flag flag andorra ad nation country banner'
],[
'🇦🇪',
'flag: United Arab Emirates',
'flag flag united arab emirates united arab emirates nation country banner'
],[
'🇦🇫',
'flag: Afghanistan',
'flag flag afghanistan af nation country banner'
],[
'🇦🇬',
'flag: Antigua & Barbuda',
'flag flag antigua barbuda antigua barbuda nation country banner'
],[
'🇦🇮',
'flag: Anguilla',
'flag flag anguilla ai nation country banner'
],[
'🇦🇱',
'flag: Albania',
'flag flag albania al nation country banner'
],[
'🇦🇲',
'flag: Armenia',
'flag flag armenia am nation country banner'
],[
'🇦🇴',
'flag: Angola',
'flag flag angola ao nation country banner'
],[
'🇦🇶',
'flag: Antarctica',
'flag flag antarctica aq nation country banner'
],[
'🇦🇷',
'flag: Argentina',
'flag flag argentina ar nation country banner'
],[
'🇦🇸',
'flag: American Samoa',
'flag flag american samoa american ws nation country banner'
],[
'🇦🇹',
'flag: Austria',
'flag flag austria at nation country banner'
],[
'🇦🇺',
'flag: Australia',
'flag flag australia au nation country banner'
],[
'🇦🇼',
'flag: Aruba',
'flag flag aruba aw nation country banner'
],[
'🇦🇽',
'flag: Åland Islands',
'flag flag aland islands Åland islands nation country banner'
],[
'🇦🇿',
'flag: Azerbaijan',
'flag flag azerbaijan az nation country banner'
],[
'🇧🇦',
'flag: Bosnia & Herzegovina',
'flag flag bosnia herzegovina bosnia herzegovina nation country banner'
],[
'🇧🇧',
'flag: Barbados',
'flag flag barbados bb nation country banner'
],[
'🇧🇩',
'flag: Bangladesh',
'flag flag bangladesh bd nation country banner'
],[
'🇧🇪',
'flag: Belgium',
'flag flag belgium be nation country banner'
],[
'🇧🇫',
'flag: Burkina Faso',
'flag flag burkina faso burkina faso nation country banner'
],[
'🇧🇬',
'flag: Bulgaria',
'flag flag bulgaria bg nation country banner'
],[
'🇧🇭',
'flag: Bahrain',
'flag flag bahrain bh nation country banner'
],[
'🇧🇮',
'flag: Burundi',
'flag flag burundi bi nation country banner'
],[
'🇧🇯',
'flag: Benin',
'flag flag benin bj nation country banner'
],[
'🇧🇱',
'flag: St. Barthélemy',
'flag flag st barthelemy saint barthélemy nation country banner'
],[
'🇧🇲',
'flag: Bermuda',
'flag flag bermuda bm nation country banner'
],[
'🇧🇳',
'flag: Brunei',
'flag flag brunei bn darussalam nation country banner'
],[
'🇧🇴',
'flag: Bolivia',
'flag flag bolivia bo nation country banner'
],[
'🇧🇶',
'flag: Caribbean Netherlands',
'flag flag caribbean netherlands bonaire nation country banner'
],[
'🇧🇷',
'flag: Brazil',
'flag flag brazil br nation country banner'
],[
'🇧🇸',
'flag: Bahamas',
'flag flag bahamas bs nation country banner'
],[
'🇧🇹',
'flag: Bhutan',
'flag flag bhutan bt nation country banner'
],[
'🇧🇻',
'flag: Bouvet Island',
'flag flag bouvet island norway'
],[
'🇧🇼',
'flag: Botswana',
'flag flag botswana bw nation country banner'
],[
'🇧🇾',
'flag: Belarus',
'flag flag belarus by nation country banner'
],[
'🇧🇿',
'flag: Belize',
'flag flag belize bz nation country banner'
],[
'🇨🇦',
'flag: Canada',
'flag flag canada ca nation country banner'
],[
'🇨🇨',
'flag: Cocos (Keeling) Islands',
'flag flag cocos islands cocos keeling islands nation country banner'
],[
'🇨🇩',
'flag: Congo - Kinshasa',
'flag flag congo kinshasa congo democratic republic nation country banner'
],[
'🇨🇫',
'flag: Central African Republic',
'flag flag central african republic central african republic nation country banner'
],[
'🇨🇬',
'flag: Congo - Brazzaville',
'flag flag congo brazzaville congo nation country banner'
],[
'🇨🇭',
'flag: Switzerland',
'flag flag switzerland ch nation country banner'
],[
'🇨🇮',
'flag: Côte d’Ivoire',
'flag flag cote d ivoire ivory coast nation country banner'
],[
'🇨🇰',
'flag: Cook Islands',
'flag flag cook islands cook islands nation country banner'
],[
'🇨🇱',
'flag: Chile',
'flag flag chile nation country banner'
],[
'🇨🇲',
'flag: Cameroon',
'flag flag cameroon cm nation country banner'
],[
'🇨🇳',
'flag: China',
'flag flag china china chinese prc country nation banner'
],[
'🇨🇴',
'flag: Colombia',
'flag flag colombia co nation country banner'
],[
'🇨🇵',
'flag: Clipperton Island',
'flag flag clipperton island'
],[
'🇨🇶',
'flag: Sark',
'flag flag sark'
],[
'🇨🇷',
'flag: Costa Rica',
'flag flag costa rica costa rica nation country banner'
],[
'🇨🇺',
'flag: Cuba',
'flag flag cuba cu nation country banner'
],[
'🇨🇻',
'flag: Cape Verde',
'flag flag cape verde cabo verde nation country banner'
],[
'🇨🇼',
'flag: Curaçao',
'flag flag curacao curaçao nation country banner'
],[
'🇨🇽',
'flag: Christmas Island',
'flag flag christmas island christmas island nation country banner'
],[
'🇨🇾',
'flag: Cyprus',
'flag flag cyprus cy nation country banner'
],[
'🇨🇿',
'flag: Czechia',
'flag flag czechia cz nation country banner'
],[
'🇩🇪',
'flag: Germany',
'flag flag germany german nation country banner'
],[
'🇩🇬',
'flag: Diego Garcia',
'flag flag diego garcia'
],[
'🇩🇯',
'flag: Djibouti',
'flag flag djibouti dj nation country banner'
],[
'🇩🇰',
'flag: Denmark',
'flag flag denmark dk nation country banner'
],[
'🇩🇲',
'flag: Dominica',
'flag flag dominica dm nation country banner'
],[
'🇩🇴',
'flag: Dominican Republic',
'flag flag dominican republic dominican republic nation country banner'
],[
'🇩🇿',
'flag: Algeria',
'flag flag algeria dz nation country banner'
],[
'🇪🇦',
'flag: Ceuta & Melilla',
'flag flag ceuta melilla'
],[
'🇪🇨',
'flag: Ecuador',
'flag flag ecuador ec nation country banner'
],[
'🇪🇪',
'flag: Estonia',
'flag flag estonia ee nation country banner'
],[
'🇪🇬',
'flag: Egypt',
'flag flag egypt eg nation country banner'
],[
'🇪🇭',
'flag: Western Sahara',
'flag flag western sahara western sahara nation country banner'
],[
'🇪🇷',
'flag: Eritrea',
'flag flag eritrea er nation country banner'
],[
'🇪🇸',
'flag: Spain',
'flag flag spain spain nation country banner'
],[
'🇪🇹',
'flag: Ethiopia',
'flag flag ethiopia et nation country banner'
],[
'🇪🇺',
'flag: European Union',
'flag flag european union european union banner'
],[
'🇫🇮',
'flag: Finland',
'flag flag finland fi nation country banner'
],[
'🇫🇯',
'flag: Fiji',
'flag flag fiji fj nation country banner'
],[
'🇫🇰',
'flag: Falkland Islands',
'flag flag falkland islands falkland islands malvinas nation country banner'
],[
'🇫🇲',
'flag: Micronesia',
'flag flag micronesia micronesia federated states nation country banner'
],[
'🇫🇴',
'flag: Faroe Islands',
'flag flag faroe islands faroe islands nation country banner'
],[
'🇫🇷',
'flag: France',
'flag flag france banner nation france french country'
],[
'🇬🇦',
'flag: Gabon',
'flag flag gabon ga nation country banner'
],[
'🇬🇧',
'flag: United Kingdom',
'flag flag united kingdom united kingdom great britain northern ireland nation country banner british UK english england union jack'
],[
'🇬🇩',
'flag: Grenada',
'flag flag grenada gd nation country banner'
],[
'🇬🇪',
'flag: Georgia',
'flag flag georgia ge nation country banner'
],[
'🇬🇫',
'flag: French Guiana',
'flag flag french guiana french guiana nation country banner'
],[
'🇬🇬',
'flag: Guernsey',
'flag flag guernsey gg nation country banner'
],[
'🇬🇭',
'flag: Ghana',
'flag flag ghana gh nation country banner'
],[
'🇬🇮',
'flag: Gibraltar',
'flag flag gibraltar gi nation country banner'
],[
'🇬🇱',
'flag: Greenland',
'flag flag greenland gl nation country banner'
],[
'🇬🇲',
'flag: Gambia',
'flag flag gambia gm nation country banner'
],[
'🇬🇳',
'flag: Guinea',
'flag flag guinea gn nation country banner'
],[
'🇬🇵',
'flag: Guadeloupe',
'flag flag guadeloupe gp nation country banner'
],[
'🇬🇶',
'flag: Equatorial Guinea',
'flag flag equatorial guinea equatorial gn nation country banner'
],[
'🇬🇷',
'flag: Greece',
'flag flag greece gr nation country banner'
],[
'🇬🇸',
'flag: South Georgia & South Sandwich Islands',
'flag flag south georgia south sandwich islands south georgia sandwich islands nation country banner'
],[
'🇬🇹',
'flag: Guatemala',
'flag flag guatemala gt nation country banner'
],[
'🇬🇺',
'flag: Guam',
'flag flag guam gu nation country banner'
],[
'🇬🇼',
'flag: Guinea-Bissau',
'flag flag guinea bissau gw bissau nation country banner'
],[
'🇬🇾',
'flag: Guyana',
'flag flag guyana gy nation country banner'
],[
'🇭🇰',
'flag: Hong Kong SAR China',
'flag flag hong kong sar china hong kong nation country banner'
],[
'🇭🇲',
'flag: Heard & McDonald Islands',
'flag flag heard mcdonald islands'
],[
'🇭🇳',
'flag: Honduras',
'flag flag honduras hn nation country banner'
],[
'🇭🇷',
'flag: Croatia',
'flag flag croatia hr nation country banner'
],[
'🇭🇹',
'flag: Haiti',
'flag flag haiti ht nation country banner'
],[
'🇭🇺',
'flag: Hungary',
'flag flag hungary hu nation country banner'
],[
'🇮🇨',
'flag: Canary Islands',
'flag flag canary islands canary islands nation country banner'
],[
'🇮🇩',
'flag: Indonesia',
'flag flag indonesia nation country banner'
],[
'🇮🇪',
'flag: Ireland',
'flag flag ireland ie nation country banner'
],[
'🇮🇱',
'flag: Israel',
'flag flag israel il nation country banner'
],[
'🇮🇲',
'flag: Isle of Man',
'flag flag isle of man isle man nation country banner'
],[
'🇮🇳',
'flag: India',
'flag flag india in nation country banner'
],[
'🇮🇴',
'flag: British Indian Ocean Territory',
'flag flag british indian ocean territory british indian ocean territory nation country banner'
],[
'🇮🇶',
'flag: Iraq',
'flag flag iraq iq nation country banner'
],[
'🇮🇷',
'flag: Iran',
'flag flag iran iran islamic republic nation country banner'
],[
'🇮🇸',
'flag: Iceland',
'flag flag iceland is nation country banner'
],[
'🇮🇹',
'flag: Italy',
'flag flag italy italy nation country banner'
],[
'🇯🇪',
'flag: Jersey',
'flag flag jersey je nation country banner'
],[
'🇯🇲',
'flag: Jamaica',
'flag flag jamaica jm nation country banner'
],[
'🇯🇴',
'flag: Jordan',
'flag flag jordan jo nation country banner'
],[
'🇯🇵',
'flag: Japan',
'flag flag japan japanese nation country banner'
],[
'🇰🇪',
'flag: Kenya',
'flag flag kenya ke nation country banner'
],[
'🇰🇬',
'flag: Kyrgyzstan',
'flag flag kyrgyzstan kg nation country banner'
],[
'🇰🇭',
'flag: Cambodia',
'flag flag cambodia kh nation country banner'
],[
'🇰🇮',
'flag: Kiribati',
'flag flag kiribati ki nation country banner'
],[
'🇰🇲',
'flag: Comoros',
'flag flag comoros km nation country banner'
],[
'🇰🇳',
'flag: St. Kitts & Nevis',
'flag flag st kitts nevis saint kitts nevis nation country banner'
],[
'🇰🇵',
'flag: North Korea',
'flag flag north korea north korea nation country banner'
],[
'🇰🇷',
'flag: South Korea',
'flag flag south korea south korea nation country banner'
],[
'🇰🇼',
'flag: Kuwait',
'flag flag kuwait kw nation country banner'
],[
'🇰🇾',
'flag: Cayman Islands',
'flag flag cayman islands cayman islands nation country banner'
],[
'🇰🇿',
'flag: Kazakhstan',
'flag flag kazakhstan kz nation country banner'
],[
'🇱🇦',
'flag: Laos',
'flag flag laos lao democratic republic nation country banner'
],[
'🇱🇧',
'flag: Lebanon',
'flag flag lebanon lb nation country banner'
],[
'🇱🇨',
'flag: St. Lucia',
'flag flag st lucia saint lucia nation country banner'
],[
'🇱🇮',
'flag: Liechtenstein',
'flag flag liechtenstein li nation country banner'
],[
'🇱🇰',
'flag: Sri Lanka',
'flag flag sri lanka sri lanka nation country banner'
],[
'🇱🇷',
'flag: Liberia',
'flag flag liberia lr nation country banner'
],[
'🇱🇸',
'flag: Lesotho',
'flag flag lesotho ls nation country banner'
],[
'🇱🇹',
'flag: Lithuania',
'flag flag lithuania lt nation country banner'
],[
'🇱🇺',
'flag: Luxembourg',
'flag flag luxembourg lu nation country banner'
],[
'🇱🇻',
'flag: Latvia',
'flag flag latvia lv nation country banner'
],[
'🇱🇾',
'flag: Libya',
'flag flag libya ly nation country banner'
],[
'🇲🇦',
'flag: Morocco',
'flag flag morocco ma nation country banner'
],[
'🇲🇨',
'flag: Monaco',
'flag flag monaco mc nation country banner'
],[
'🇲🇩',
'flag: Moldova',
'flag flag moldova moldova republic nation country banner'
],[
'🇲🇪',
'flag: Montenegro',
'flag flag montenegro me nation country banner'
],[
'🇲🇫',
'flag: St. Martin',
'flag flag st martin'
],[
'🇲🇬',
'flag: Madagascar',
'flag flag madagascar mg nation country banner'
],[
'🇲🇭',
'flag: Marshall Islands',
'flag flag marshall islands marshall islands nation country banner'
],[
'🇲🇰',
'flag: North Macedonia',
'flag flag north macedonia macedonia nation country banner'
],[
'🇲🇱',
'flag: Mali',
'flag flag mali ml nation country banner'
],[
'🇲🇲',
'flag: Myanmar (Burma)',
'flag flag myanmar mm nation country banner'
],[
'🇲🇳',
'flag: Mongolia',
'flag flag mongolia mn nation country banner'
],[
'🇲🇴',
'flag: Macao SAR China',
'flag flag macao sar china macao nation country banner'
],[
'🇲🇵',
'flag: Northern Mariana Islands',
'flag flag northern mariana islands northern mariana islands nation country banner'
],[
'🇲🇶',
'flag: Martinique',
'flag flag martinique mq nation country banner'
],[
'🇲🇷',
'flag: Mauritania',
'flag flag mauritania mr nation country banner'
],[
'🇲🇸',
'flag: Montserrat',
'flag flag montserrat ms nation country banner'
],[
'🇲🇹',
'flag: Malta',
'flag flag malta mt nation country banner'
],[
'🇲🇺',
'flag: Mauritius',
'flag flag mauritius mu nation country banner'
],[
'🇲🇻',
'flag: Maldives',
'flag flag maldives mv nation country banner'
],[
'🇲🇼',
'flag: Malawi',
'flag flag malawi mw nation country banner'
],[
'🇲🇽',
'flag: Mexico',
'flag flag mexico mx nation country banner'
],[
'🇲🇾',
'flag: Malaysia',
'flag flag malaysia my nation country banner'
],[
'🇲🇿',
'flag: Mozambique',
'flag flag mozambique mz nation country banner'
],[
'🇳🇦',
'flag: Namibia',
'flag flag namibia na nation country banner'
],[
'🇳🇨',
'flag: New Caledonia',
'flag flag new caledonia new caledonia nation country banner'
],[
'🇳🇪',
'flag: Niger',
'flag flag niger ne nation country banner'
],[
'🇳🇫',
'flag: Norfolk Island',
'flag flag norfolk island norfolk island nation country banner'
],[
'🇳🇬',
'flag: Nigeria',
'flag flag nigeria nation country banner'
],[
'🇳🇮',
'flag: Nicaragua',
'flag flag nicaragua ni nation country banner'
],[
'🇳🇱',
'flag: Netherlands',
'flag flag netherlands nl nation country banner'
],[
'🇳🇴',
'flag: Norway',
'flag flag norway no nation country banner'
],[
'🇳🇵',
'flag: Nepal',
'flag flag nepal np nation country banner'
],[
'🇳🇷',
'flag: Nauru',
'flag flag nauru nr nation country banner'
],[
'🇳🇺',
'flag: Niue',
'flag flag niue nu nation country banner'
],[
'🇳🇿',
'flag: New Zealand',
'flag flag new zealand new zealand nation country banner'
],[
'🇴🇲',
'flag: Oman',
'flag flag oman om symbol nation country banner'
],[
'🇵🇦',
'flag: Panama',
'flag flag panama pa nation country banner'
],[
'🇵🇪',
'flag: Peru',
'flag flag peru pe nation country banner'
],[
'🇵🇫',
'flag: French Polynesia',
'flag flag french polynesia french polynesia nation country banner'
],[
'🇵🇬',
'flag: Papua New Guinea',
'flag flag papua new guinea papua new guinea nation country banner'
],[
'🇵🇭',
'flag: Philippines',
'flag flag philippines ph nation country banner'
],[
'🇵🇰',
'flag: Pakistan',
'flag flag pakistan pk nation country banner'
],[
'🇵🇱',
'flag: Poland',
'flag flag poland pl nation country banner'
],[
'🇵🇲',
'flag: St. Pierre & Miquelon',
'flag flag st pierre miquelon saint pierre miquelon nation country banner'
],[
'🇵🇳',
'flag: Pitcairn Islands',
'flag flag pitcairn islands pitcairn nation country banner'
],[
'🇵🇷',
'flag: Puerto Rico',
'flag flag puerto rico puerto rico nation country banner'
],[
'🇵🇸',
'flag: Palestinian Territories',
'flag flag palestinian territories palestine palestinian territories nation country banner'
],[
'🇵🇹',
'flag: Portugal',
'flag flag portugal pt nation country banner'
],[
'🇵🇼',
'flag: Palau',
'flag flag palau pw nation country banner'
],[
'🇵🇾',
'flag: Paraguay',
'flag flag paraguay py nation country banner'
],[
'🇶🇦',
'flag: Qatar',
'flag flag qatar qa nation country banner'
],[
'🇷🇪',
'flag: Réunion',
'flag flag reunion réunion nation country banner'
],[
'🇷🇴',
'flag: Romania',
'flag flag romania ro nation country banner'
],[
'🇷🇸',
'flag: Serbia',
'flag flag serbia rs nation country banner'
],[
'🇷🇺',
'flag: Russia',
'flag flag russia russian federation nation country banner'
],[
'🇷🇼',
'flag: Rwanda',
'flag flag rwanda rw nation country banner'
],[
'🇸🇦',
'flag: Saudi Arabia',
'flag flag saudi arabia nation country banner'
],[
'🇸🇧',
'flag: Solomon Islands',
'flag flag solomon islands solomon islands nation country banner'
],[
'🇸🇨',
'flag: Seychelles',
'flag flag seychelles sc nation country banner'
],[
'🇸🇩',
'flag: Sudan',
'flag flag sudan sd nation country banner'
],[
'🇸🇪',
'flag: Sweden',
'flag flag sweden se nation country banner'
],[
'🇸🇬',
'flag: Singapore',
'flag flag singapore sg nation country banner'
],[
'🇸🇭',
'flag: St. Helena',
'flag flag st helena saint helena ascension tristan cunha nation country banner'
],[
'🇸🇮',
'flag: Slovenia',
'flag flag slovenia si nation country banner'
],[
'🇸🇯',
'flag: Svalbard & Jan Mayen',
'flag flag svalbard jan mayen'
],[
'🇸🇰',
'flag: Slovakia',
'flag flag slovakia sk nation country banner'
],[
'🇸🇱',
'flag: Sierra Leone',
'flag flag sierra leone sierra leone nation country banner'
],[
'🇸🇲',
'flag: San Marino',
'flag flag san marino san marino nation country banner'
],[
'🇸🇳',
'flag: Senegal',
'flag flag senegal sn nation country banner'
],[
'🇸🇴',
'flag: Somalia',
'flag flag somalia so nation country banner'
],[
'🇸🇷',
'flag: Suriname',
'flag flag suriname sr nation country banner'
],[
'🇸🇸',
'flag: South Sudan',
'flag flag south sudan south sd nation country banner'
],[
'🇸🇹',
'flag: São Tomé & Príncipe',
'flag flag sao tome principe sao tome principe nation country banner'
],[
'🇸🇻',
'flag: El Salvador',
'flag flag el salvador el salvador nation country banner'
],[
'🇸🇽',
'flag: Sint Maarten',
'flag flag sint maarten sint maarten dutch nation country banner'
],[
'🇸🇾',
'flag: Syria',
'flag flag syria syrian arab republic nation country banner'
],[
'🇸🇿',
'flag: Eswatini',
'flag flag eswatini sz nation country banner'
],[
'🇹🇦',
'flag: Tristan da Cunha',
'flag flag tristan da cunha'
],[
'🇹🇨',
'flag: Turks & Caicos Islands',
'flag flag turks caicos islands turks caicos islands nation country banner'
],[
'🇹🇩',
'flag: Chad',
'flag flag chad td nation country banner'
],[
'🇹🇫',
'flag: French Southern Territories',
'flag flag french southern territories french southern territories nation country banner'
],[
'🇹🇬',
'flag: Togo',
'flag flag togo tg nation country banner'
],[
'🇹🇭',
'flag: Thailand',
'flag flag thailand th nation country banner'
],[
'🇹🇯',
'flag: Tajikistan',
'flag flag tajikistan tj nation country banner'
],[
'🇹🇰',
'flag: Tokelau',
'flag flag tokelau tk nation country banner'
],[
'🇹🇱',
'flag: Timor-Leste',
'flag flag timor leste timor leste nation country banner'
],[
'🇹🇲',
'flag: Turkmenistan',
'flag flag turkmenistan nation country banner'
],[
'🇹🇳',
'flag: Tunisia',
'flag flag tunisia tn nation country banner'
],[
'🇹🇴',
'flag: Tonga',
'flag flag tonga to nation country banner'
],[
'🇹🇷',
'flag: Turkey',
'flag flag turkey turkey nation country banner'
],[
'🇹🇹',
'flag: Trinidad & Tobago',
'flag flag trinidad tobago trinidad tobago nation country banner'
],[
'🇹🇻',
'flag: Tuvalu',
'flag flag tuvalu nation country banner'
],[
'🇹🇼',
'flag: Taiwan',
'flag flag taiwan tw nation country banner'
],[
'🇹🇿',
'flag: Tanzania',
'flag flag tanzania tanzania united republic nation country banner'
],[
'🇺🇦',
'flag: Ukraine',
'flag flag ukraine ua nation country banner'
],[
'🇺🇬',
'flag: Uganda',
'flag flag uganda ug nation country banner'
],[
'🇺🇲',
'flag: U.S. Outlying Islands',
'flag flag u s outlying islands'
],[
'🇺🇳',
'flag: United Nations',
'flag flag united nations un banner'
],[
'🇺🇸',
'flag: United States',
'flag flag united states united states america nation country banner'
],[
'🇺🇾',
'flag: Uruguay',
'flag flag uruguay uy nation country banner'
],[
'🇺🇿',
'flag: Uzbekistan',
'flag flag uzbekistan uz nation country banner'
],[
'🇻🇦',
'flag: Vatican City',
'flag flag vatican city vatican city nation country banner'
],[
'🇻🇨',
'flag: St. Vincent & Grenadines',
'flag flag st vincent grenadines saint vincent grenadines nation country banner'
],[
'🇻🇪',
'flag: Venezuela',
'flag flag venezuela ve bolivarian republic nation country banner'
],[
'🇻🇬',
'flag: British Virgin Islands',
'flag flag british virgin islands british virgin islands bvi nation country banner'
],[
'🇻🇮',
'flag: U.S. Virgin Islands',
'flag flag u s virgin islands virgin islands us nation country banner'
],[
'🇻🇳',
'flag: Vietnam',
'flag flag vietnam viet nam nation country banner'
],[
'🇻🇺',
'flag: Vanuatu',
'flag flag vanuatu vu nation country banner'
],[
'🇼🇫',
'flag: Wallis & Futuna',
'flag flag wallis futuna wallis futuna nation country banner'
],[
'🇼🇸',
'flag: Samoa',
'flag flag samoa ws nation country banner'
],[
'🇽🇰',
'flag: Kosovo',
'flag flag kosovo xk nation country banner'
],[
'🇾🇪',
'flag: Yemen',
'flag flag yemen ye nation country banner'
],[
'🇾🇹',
'flag: Mayotte',
'flag flag mayotte yt nation country banner'
],[
'🇿🇦',
'flag: South Africa',
'flag flag south africa south africa nation country banner'
],[
'🇿🇲',
'flag: Zambia',
'flag flag zambia zm nation country banner'
],[
'🇿🇼',
'flag: Zimbabwe',
'flag flag zimbabwe zw nation country banner'
],[
'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
'flag: England',
'flag flag england english'
],[
'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
'flag: Scotland',
'flag flag scotland scottish'
],[
'🏴󠁧󠁢󠁷󠁬󠁳󠁿',
'flag: Wales',
'flag flag wales welsh'
]
];

//this list is taken from https://unicode.org/emoji/charts/full-emoji-modifiers.html
//Full Emoji Modifier Sequences, v15.1

const MODED = [
'👋🏻',
'🤚🏻',
'🖐🏻',
'✋🏻',
'🖖🏻',
'🫱🏻',
'🫲🏻',
'🫳🏻',
'🫴🏻',
'🫷🏻',
'🫸🏻',
'👌🏻',
'🤌🏻',
'🤏🏻',
'✌🏻',
'🤞🏻',
'🫰🏻',
'🤟🏻',
'🤘🏻',
'🤙🏻',
'👈🏻',
'👉🏻',
'👆🏻',
'🖕🏻',
'👇🏻',
'☝🏻',
'🫵🏻',
'👍🏻',
'👎🏻',
'✊🏻',
'👊🏻',
'🤛🏻',
'🤜🏻',
'👏🏻',
'🙌🏻',
'🫶🏻',
'👐🏻',
'🤲🏻',
'🤝🏻',
'🙏🏻',
'✍🏻',
'💅🏻',
'🤳🏻',
'💪🏻',
'🦵🏻',
'🦶🏻',
'👂🏻',
'🦻🏻',
'👃🏻',
'👶🏻',
'🧒🏻',
'👦🏻',
'👧🏻',
'🧑🏻',
'👱🏻',
'👨🏻',
'🧔🏻',
'🧔🏻‍♂️',
'🧔🏻‍♀️',
'👨🏻‍🦰',
'👨🏻‍🦱',
'👨🏻‍🦳',
'👨🏻‍🦲',
'👩🏻',
'👩🏻‍🦰',
'🧑🏻‍🦰',
'👩🏻‍🦱',
'🧑🏻‍🦱',
'👩🏻‍🦳',
'🧑🏻‍🦳',
'👩🏻‍🦲',
'🧑🏻‍🦲',
'👱🏻‍♀️',
'👱🏻‍♂️',
'🧓🏻',
'👴🏻',
'👵🏻',
'🙍🏻',
'🙍🏻‍♂️',
'🙍🏻‍♀️',
'🙎🏻',
'🙎🏻‍♂️',
'🙎🏻‍♀️',
'🙅🏻',
'🙅🏻‍♂️',
'🙅🏻‍♀️',
'🙆🏻',
'🙆🏻‍♂️',
'🙆🏻‍♀️',
'💁🏻',
'💁🏻‍♂️',
'💁🏻‍♀️',
'🙋🏻',
'🙋🏻‍♂️',
'🙋🏻‍♀️',
'🧏🏻',
'🧏🏻‍♂️',
'🧏🏻‍♀️',
'🙇🏻',
'🙇🏻‍♂️',
'🙇🏻‍♀️',
'🤦🏻',
'🤦🏻‍♂️',
'🤦🏻‍♀️',
'🤷🏻',
'🤷🏻‍♂️',
'🤷🏻‍♀️',
'🧑🏻‍⚕️',
'👨🏻‍⚕️',
'👩🏻‍⚕️',
'🧑🏻‍🎓',
'👨🏻‍🎓',
'👩🏻‍🎓',
'🧑🏻‍🏫',
'👨🏻‍🏫',
'👩🏻‍🏫',
'🧑🏻‍⚖️',
'👨🏻‍⚖️',
'👩🏻‍⚖️',
'🧑🏻‍🌾',
'👨🏻‍🌾',
'👩🏻‍🌾',
'🧑🏻‍🍳',
'👨🏻‍🍳',
'👩🏻‍🍳',
'🧑🏻‍🔧',
'👨🏻‍🔧',
'👩🏻‍🔧',
'🧑🏻‍🏭',
'👨🏻‍🏭',
'👩🏻‍🏭',
'🧑🏻‍💼',
'👨🏻‍💼',
'👩🏻‍💼',
'🧑🏻‍🔬',
'👨🏻‍🔬',
'👩🏻‍🔬',
'🧑🏻‍💻',
'👨🏻‍💻',
'👩🏻‍💻',
'🧑🏻‍🎤',
'👨🏻‍🎤',
'👩🏻‍🎤',
'🧑🏻‍🎨',
'👨🏻‍🎨',
'👩🏻‍🎨',
'🧑🏻‍✈️',
'👨🏻‍✈️',
'👩🏻‍✈️',
'🧑🏻‍🚀',
'👨🏻‍🚀',
'👩🏻‍🚀',
'🧑🏻‍🚒',
'👨🏻‍🚒',
'👩🏻‍🚒',
'👮🏻',
'👮🏻‍♂️',
'👮🏻‍♀️',
'🕵🏻',
'🕵🏻‍♂️',
'🕵🏻‍♀️',
'💂🏻',
'💂🏻‍♂️',
'💂🏻‍♀️',
'🥷🏻',
'👷🏻',
'👷🏻‍♂️',
'👷🏻‍♀️',
'🫅🏻',
'🤴🏻',
'👸🏻',
'👳🏻',
'👳🏻‍♂️',
'👳🏻‍♀️',
'👲🏻',
'🧕🏻',
'🤵🏻',
'🤵🏻‍♂️',
'🤵🏻‍♀️',
'👰🏻',
'👰🏻‍♂️',
'👰🏻‍♀️',
'🤰🏻',
'🫃🏻',
'🫄🏻',
'🤱🏻',
'👩🏻‍🍼',
'👨🏻‍🍼',
'🧑🏻‍🍼',
'👼🏻',
'🎅🏻',
'🤶🏻',
'🧑🏻‍🎄',
'🦸🏻',
'🦸🏻‍♂️',
'🦸🏻‍♀️',
'🦹🏻',
'🦹🏻‍♂️',
'🦹🏻‍♀️',
'🧙🏻',
'🧙🏻‍♂️',
'🧙🏻‍♀️',
'🧚🏻',
'🧚🏻‍♂️',
'🧚🏻‍♀️',
'🧛🏻',
'🧛🏻‍♂️',
'🧛🏻‍♀️',
'🧜🏻',
'🧜🏻‍♂️',
'🧜🏻‍♀️',
'🧝🏻',
'🧝🏻‍♂️',
'🧝🏻‍♀️',
'💆🏻',
'💆🏻‍♂️',
'💆🏻‍♀️',
'💇🏻',
'💇🏻‍♂️',
'💇🏻‍♀️',
'🚶🏻',
'🚶🏻‍♂️',
'🚶🏻‍♀️',
'🚶🏻‍➡️',
'🚶🏻‍♀️‍➡️',
'🚶🏻‍♂️‍➡️',
'🧍🏻',
'🧍🏻‍♂️',
'🧍🏻‍♀️',
'🧎🏻',
'🧎🏻‍♂️',
'🧎🏻‍♀️',
'🧎🏻‍➡️',
'🧎🏻‍♀️‍➡️',
'🧎🏻‍♂️‍➡️',
'🧑🏻‍🦯',
'🧑🏻‍🦯‍➡️',
'👨🏻‍🦯',
'👨🏻‍🦯‍➡️',
'👩🏻‍🦯',
'👩🏻‍🦯‍➡️',
'🧑🏻‍🦼',
'🧑🏻‍🦼‍➡️',
'👨🏻‍🦼',
'👨🏻‍🦼‍➡️',
'👩🏻‍🦼',
'👩🏻‍🦼‍➡️',
'🧑🏻‍🦽',
'🧑🏻‍🦽‍➡️',
'👨🏻‍🦽',
'👨🏻‍🦽‍➡️',
'👩🏻‍🦽',
'👩🏻‍🦽‍➡️',
'🏃🏻',
'🏃🏻‍♂️',
'🏃🏻‍♀️',
'🏃🏻‍➡️',
'🏃🏻‍♀️‍➡️',
'🏃🏻‍♂️‍➡️',
'💃🏻',
'🕺🏻',
'🕴🏻',
'🧖🏻',
'🧖🏻‍♂️',
'🧖🏻‍♀️',
'🧗🏻',
'🧗🏻‍♂️',
'🧗🏻‍♀️',
'🏇🏻',
'🏂🏻',
'🏌🏻',
'🏌🏻‍♂️',
'🏌🏻‍♀️',
'🏄🏻',
'🏄🏻‍♂️',
'🏄🏻‍♀️',
'🚣🏻',
'🚣🏻‍♂️',
'🚣🏻‍♀️',
'🏊🏻',
'🏊🏻‍♂️',
'🏊🏻‍♀️',
'⛹🏻',
'⛹🏻‍♂️',
'⛹🏻‍♀️',
'🏋🏻',
'🏋🏻‍♂️',
'🏋🏻‍♀️',
'🚴🏻',
'🚴🏻‍♂️',
'🚴🏻‍♀️',
'🚵🏻',
'🚵🏻‍♂️',
'🚵🏻‍♀️',
'🤸🏻',
'🤸🏻‍♂️',
'🤸🏻‍♀️',
'🤽🏻',
'🤽🏻‍♂️',
'🤽🏻‍♀️',
'🤾🏻',
'🤾🏻‍♂️',
'🤾🏻‍♀️',
'🤹🏻',
'🤹🏻‍♂️',
'🤹🏻‍♀️',
'🧘🏻',
'🧘🏻‍♂️',
'🧘🏻‍♀️',
'🛀🏻',
'🛌🏻',
'🧑🏻‍🤝‍🧑🏻',
'👭🏻',
'👫🏻',
'👬🏻',
'💏🏻',
'👩🏻‍❤️‍💋‍👨🏻',
'👨🏻‍❤️‍💋‍👨🏻',
'👩🏻‍❤️‍💋‍👩🏻',
'💑🏻',
'👩🏻‍❤️‍👨🏻',
'👨🏻‍❤️‍👨🏻',
'👩🏻‍❤️‍👩🏻'

];

// MODED is the emojis with the skin tone modifier \u{1F3FB} included
// create MODABLE[], the same emoji but with the skin tone modifiers removed.
const MODABLE = [];
for (let i = 0; i < MODED.length; i++) {
    MODABLE[i] = MODED[i].replace(/\u{1F3FB}/ug, '');
}

module.exports = {EMOJI, MODED, MODABLE};
