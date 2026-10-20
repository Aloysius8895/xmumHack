"""Chinese names for common objects in YOLOE's vocabulary, and which labels are not objects.

YOLOE names are lowercase English, often compounds ("plastic bottle", "ceiling fan").
The last word is the head noun, so it decides both the fallback translation and
whether a label is a person or a piece of the room rather than an object."""

ZH = {
    # drink and kitchen
    "cup": "杯子", "mug": "马克杯", "coffee cup": "咖啡杯", "tea cup": "茶杯", "wine glass": "酒杯",
    "glass": "玻璃杯", "bottle": "瓶子", "water bottle": "水瓶", "thermos": "保温杯", "can": "罐子",
    "bowl": "碗", "plate": "盘子", "spoon": "勺子", "fork": "叉子", "knife": "刀", "chopstick": "筷子",
    "kettle": "水壶", "teapot": "茶壶", "jar": "罐子", "lid": "盖子", "bottle cap": "瓶盖", "tray": "托盘",
    "coaster": "杯垫", "lunch box": "饭盒", "container": "容器", "straw": "吸管",
    # electronics
    "laptop": "笔记本电脑", "computer": "电脑", "computer monitor": "显示器", "monitor": "显示器",
    "screen": "屏幕", "television": "电视", "keyboard": "键盘", "mouse": "鼠标", "pad": "垫子",
    "speaker": "音箱", "earphone": "耳机", "headphone": "耳机", "microphone": "麦克风", "webcam": "摄像头",
    "camera": "相机", "phone": "手机", "smartphone": "手机", "tablet": "平板", "charger": "充电器",
    "cable": "数据线", "plug": "插头", "strip": "插线板", "remote": "遥控器", "control": "遥控器",
    "game controller": "游戏手柄", "router": "路由器", "drive": "硬盘", "battery": "电池",
    "power bank": "充电宝", "calculator": "计算器", "printer": "打印机",
    # stationery
    "book": "书", "notebook": "笔记本", "paper": "纸", "pen": "笔", "pencil": "铅笔", "eraser": "橡皮",
    "ruler": "尺子", "scissors": "剪刀", "stapler": "订书机", "tape": "胶带", "note": "便签",
    "notepad": "记事本", "folder": "文件夹", "file": "文件", "envelope": "信封", "clipboard": "写字板",
    "pencil case": "笔袋", "marker": "马克笔", "card": "卡片", "sticker": "贴纸", "document": "文件",
    # furniture and room objects
    "table": "桌子", "desk": "书桌", "chair": "椅子", "office chair": "办公椅", "stool": "凳子",
    "couch": "沙发", "sofa": "沙发", "bed": "床", "pillow": "枕头", "cushion": "靠垫", "blanket": "毯子",
    "shelf": "架子", "bookshelf": "书架", "cabinet": "柜子", "drawer": "抽屉", "box": "盒子",
    "cardboard box": "纸箱", "storage box": "收纳盒", "basket": "篮子", "bin": "垃圾桶",
    "lamp": "台灯", "light": "灯", "fan": "风扇", "ceiling fan": "吊扇", "air conditioner": "空调",
    "heater": "暖气", "clock": "钟", "alarm clock": "闹钟", "wall clock": "挂钟", "picture frame": "相框",
    "photo frame": "相框", "mirror": "镜子", "vase": "花瓶", "plant": "植物", "pot": "盆",
    "flower": "花", "curtain": "窗帘", "door": "门", "window": "窗户", "poster": "海报", "painting": "画",
    # personal things
    "bag": "包", "backpack": "背包", "handbag": "手提包", "wallet": "钱包", "key": "钥匙", "watch": "手表",
    "glasses": "眼镜", "sunglasses": "墨镜", "hat": "帽子", "cap": "帽子", "umbrella": "雨伞",
    "shoe": "鞋", "sock": "袜子", "towel": "毛巾", "tissue": "纸巾", "napkin": "餐巾纸",
    "toilet paper": "卫生纸", "toy": "玩具", "teddy bear": "玩具熊", "bear": "熊", "doll": "娃娃",
    "figurine": "摆件", "ball": "球", "candle": "蜡烛", "perfume": "香水", "lipstick": "口红",
    "toothbrush": "牙刷", "toothpaste": "牙膏", "comb": "梳子", "brush": "刷子", "hair drier": "吹风机",
    "tie": "领带", "ring": "戒指", "necklace": "项链", "bracelet": "手链", "mask": "口罩", "jacket": "外套",
    # food
    "apple": "苹果", "banana": "香蕉", "orange": "橙子", "snack": "零食", "bread": "面包", "cake": "蛋糕",
    "fruit": "水果", "candy": "糖果", "chocolate": "巧克力",
}

# Head nouns of labels for a whole person (shown as "人" by default; P hides them). Drafted from
# WordNet (first noun sense under person.n.01) over the vocabulary's head nouns, then pruned by
# hand of objects, animals and food that WordNet files under people ("calculator", "toaster",
# "pitcher", "tiger"); ambiguous ones ("guard", "batter", "comic") count as objects.
PEOPLE = set("""
    person people man men woman women boy girl child kid baby lady gentleman guy dude chap adult
    teenager youth toddler newborn twin sibling cousin daughter mother father grandmother grandfather
    grandparent bride groom bridesmaid newlywed neighbor partner user selfie portrait model supermodel
    student graduate teacher educator professor researcher scientist physicist chemist astronomer
    historian philosopher doctor nurse surgeon dentist paramedic vet patient worker businessman
    businesswoman executive manager secretary official officer president politician minister leader
    commander captain king prince princess duchess pope bishop monk nun preacher prophet disciple
    pilgrim judge lawyer detective soldier marine airman paratrooper warrior samurai gladiator pirate
    sailor pilot astronaut engineer technician mechanic electrician plumber welder carpenter
    blacksmith craftsman lumberjack miner farmer gardener shepherd fisherman beekeeper mahout
    cowboy chef cook baker butcher bartender waiter maid nanny barber tailor florist vendor shopper
    customer client passenger pedestrian tourist hiker camper explorer mountaineer rescuer lifeguard
    volunteer protester spectator supporter participant competitor champion winner hero veteran
    senior professional celebrity socialite host entertainer performer actor actress artist painter
    sculptor designer architect animator photographer journalist writer author composer musician
    singer rapper dj drummer guitarist bassist pianist violinist violist saxophonist conductor
    dancer ballerina geisha magician joker player athlete swimmer diver rower surfer skier
    skater skateboarder snowboarder golfer boxer wrestler gymnast bodybuilder cricketer jockey rider
    equestrian motorcyclist matador referee coach trainer goalkeeper defender striker catcher scout
    guide director producer commentator hacker witch zombie brunette
""".split())
# … of body parts, which would scatter labels over a person (always hidden) …
BODY_PARTS = set("""
    face hand hair head arm leg finger eye nose mouth ear beard skin smile neck shoulder lip eyebrow
    forehead chin cheek fist palm thumb body hairstyle expression ankle foot toe hip waist chest belly
    breast jaw skull bone brain limb paw claw beak snout
    close-up profile session
""".split())   # the last row: "face close-up", "portrait session" are views of a person
# … and of labels that describe the room or the view rather than an object (always hidden).
SCENERY = {"wall", "floor", "ceiling", "room", "sky", "road", "street", "building", "office", "interior",
           "scene", "view", "background", "indoor", "outdoor", "landscape", "area", "space", "corner",
           "house", "home", "apartment", "kitchen", "bedroom", "bathroom", "classroom", "hallway",
           "studio", "shop", "store", "restaurant", "cafe", "darkness", "shadow", "night",
           "daylight", "sunlight", "color", "pattern", "texture", "design", "style", "image", "photo",
           "picture", "illustration", "blur", "reflection"}


def head(label):
    return label.split()[-1] if label else label


def zh_name(label):
    """Chinese name if known (whole label, then its head noun), otherwise the English label.
    Every person is just "人", so the label does not flip between "man", "boy", "guy" …"""
    if is_person(label):
        return "人"
    return ZH.get(label) or ZH.get(head(label)) or label


def is_person(label):
    """A whole person. Words in ZH are objects first: "speaker", "monitor", "ruler"."""
    h = head(label)
    return h in PEOPLE and label not in ZH and h not in ZH


def is_scenery(label):
    """Room, view or body part: never shown."""
    h = head(label)
    return (h in SCENERY or h in BODY_PARTS) and label not in ZH
