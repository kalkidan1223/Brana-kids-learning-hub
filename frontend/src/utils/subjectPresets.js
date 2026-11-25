// Rich child-friendly presets for Mathematics, Science, and General Knowledge (KG1 - Grade 2)
// Each item includes symbol/emoji, English & Amharic terms, phonetic transliteration, and child description.

export const MATH_NUMBERS = [
  { symbol: '0', word: 'Zero', amharic: 'ዜሮ (Zero)', dots: '○ (none)', desc: 'Zero means nothing or empty.' },
  { symbol: '1', word: 'One', amharic: 'አንድ (And)', dots: '● (1 dot)', desc: 'Number one: one single item.' },
  { symbol: '2', word: 'Two', amharic: 'ሁለት (Hulet)', dots: '●● (2 dots)', desc: 'Number two: a pair of items.' },
  { symbol: '3', word: 'Three', amharic: 'ሦስት (Sost)', dots: '●●● (3 dots)', desc: 'Number three: three items.' },
  { symbol: '4', word: 'Four', amharic: 'አራት (Arat)', dots: '●●●● (4 dots)', desc: 'Number four: four items.' },
  { symbol: '5', word: 'Five', amharic: 'አምስት (Amist)', dots: '●●●●● (5 dots)', desc: 'Number five: five fingers on a hand.' },
  { symbol: '6', word: 'Six', amharic: 'ስድስት (Sidist)', dots: '●●●●●● (6 dots)', desc: 'Number six.' },
  { symbol: '7', word: 'Seven', amharic: 'ሰባት (Sebat)', dots: '●●●●●●● (7 dots)', desc: 'Number seven: seven days in a week.' },
  { symbol: '8', word: 'Eight', amharic: 'ስምንት (Simint)', dots: '●●●●●●●● (8 dots)', desc: 'Number eight: eight legs on an octopus.' },
  { symbol: '9', word: 'Nine', amharic: 'ዘጠኝ (Zetegn)', dots: '●●●●●●●●● (9 dots)', desc: 'Number nine.' },
  { symbol: '10', word: 'Ten', amharic: 'አስር (Asir)', dots: '●●●●●●●●●● (10 dots)', desc: 'Number ten: ten fingers on two hands.' },
  { symbol: '11', word: 'Eleven', amharic: 'አስራ አንድ (Asra And)', dots: '10 + 1', desc: 'Number eleven.' },
  { symbol: '12', word: 'Twelve', amharic: 'አስራ ሁለት (Asra Hulet)', dots: '10 + 2', desc: 'Number twelve: a dozen.' },
  { symbol: '13', word: 'Thirteen', amharic: 'አስራ ሦስት (Asra Sost)', dots: '10 + 3', desc: 'Number thirteen.' },
  { symbol: '14', word: 'Fourteen', amharic: 'አስራ አራት (Asra Arat)', dots: '10 + 4', desc: 'Number fourteen.' },
  { symbol: '15', word: 'Fifteen', amharic: 'አስራ አምስት (Asra Amist)', dots: '10 + 5', desc: 'Number fifteen.' },
  { symbol: '16', word: 'Sixteen', amharic: 'አስራ ስድስት (Asra Sidist)', dots: '10 + 6', desc: 'Number sixteen.' },
  { symbol: '17', word: 'Seventeen', amharic: 'አስራ ሰባት (Asra Sebat)', dots: '10 + 7', desc: 'Number seventeen.' },
  { symbol: '18', word: 'Eighteen', amharic: 'አስራ ስምንት (Asra Simint)', dots: '10 + 8', desc: 'Number eighteen.' },
  { symbol: '19', word: 'Nineteen', amharic: 'አስራ ዘጠኝ (Asra Zetegn)', dots: '10 + 9', desc: 'Number nineteen.' },
  { symbol: '20', word: 'Twenty', amharic: 'ሃያ (Haya)', dots: '2 x 10', desc: 'Number twenty: two tens.' },
];

export const MATH_SHAPES = [
  { symbol: '⭕', word: 'Circle', amharic: 'ክብ (Kib)', desc: 'Round shape with no straight lines or corners.' },
  { symbol: '⏹️', word: 'Square', amharic: 'ካሬ (Karé)', desc: 'Four equal sides and four right angles.' },
  { symbol: '🔺', word: 'Triangle', amharic: 'ሶስት ማዕዘን (Sost Maazen)', desc: 'Shape with three straight sides and three corners.' },
  { symbol: '⭐', word: 'Star', amharic: 'ኮከብ (Kokeb)', desc: 'Five-pointed glowing star shape.' },
  { symbol: '▭', word: 'Rectangle', amharic: 'ሬክታንግል (Rectangle)', desc: 'Four sides where opposite sides are equal in length.' },
  { symbol: '💎', word: 'Diamond', amharic: 'ዳይመንድ (Rhombus)', desc: 'Diamond shape with four slanted equal sides.' },
  { symbol: '🥚', word: 'Oval', amharic: 'ኦቫል (Egg shape)', desc: 'Egg-shaped curved figure.' },
  { symbol: '❤️', word: 'Heart', amharic: 'ልብ (Lib)', desc: 'Heart shape symbol for love.' },
];

export const MATH_OPERATIONS = [
  { symbol: '➕', word: 'Plus / Addition', amharic: 'መደመር (Medemer)', desc: 'Adding or putting numbers together to make a bigger sum.' },
  { symbol: '➖', word: 'Minus / Subtraction', amharic: 'መቀነስ (Meqenes)', desc: 'Taking away or subtracting items from a group.' },
  { symbol: '🟰', word: 'Equals', amharic: 'እኩል ይሆናል (Ekul Yehonal)', desc: 'Having the exact same amount or value on both sides.' },
  { symbol: '✖️', word: 'Multiplication', amharic: 'ማባዛት (Mabazat)', desc: 'Repeated addition of groups of equal size.' },
  { symbol: '➗', word: 'Division', amharic: 'ማካፈል (Makafel)', desc: 'Sharing equally into equal parts or groups.' },
  { symbol: '＞', word: 'Greater Than', amharic: 'ይበልጣል (Yibeltal)', desc: 'Left number is bigger than the right number.' },
  { symbol: '＜', word: 'Less Than', amharic: 'ያንሳል (Yansal)', desc: 'Left number is smaller than the right number.' },
];

export const SCIENCE_COLORS = [
  { symbol: '🔴', word: 'Red', amharic: 'ቀይ (Qey)', desc: 'Bright color like ripe apples, strawberries, and roses.' },
  { symbol: '🔵', word: 'Blue', amharic: 'ሰማያዊ (Semayawi)', desc: 'Calm color like the open sky and ocean waters.' },
  { symbol: '🟢', word: 'Green', amharic: 'አረንጓዴ (Arengwadé)', desc: 'Fresh color of leaves, grass, and growing trees.' },
  { symbol: '🟡', word: 'Yellow', amharic: 'ቢጫ (Bicha)', desc: 'Bright warm color of sunshine, lemons, and bananas.' },
  { symbol: '🟠', word: 'Orange', amharic: 'ብርቱካናማ (Birtukanama)', desc: 'Warm color of oranges, carrots, and pumpkins.' },
  { symbol: '🟣', word: 'Purple', amharic: 'ወይን ጠጅ (Weyn Tejj)', desc: 'Royal color of ripe grapes and lavender flowers.' },
  { symbol: '⚪', word: 'White', amharic: 'ነጭ (Nech)', desc: 'Pure bright color of milk, snow, and fluffy clouds.' },
  { symbol: '⚫', word: 'Black', amharic: 'ጥቁር (Tiqur)', desc: 'Dark color of the starry midnight sky.' },
  { symbol: '🟤', word: 'Brown', amharic: 'ቡናማ (Bunama)', desc: 'Earthy color of soil, coffee beans, and tree trunks.' },
  { symbol: '💖', word: 'Pink', amharic: 'ሮዝ (Roz)', desc: 'Gentle color of blooming flowers and cotton candy.' },
];

export const SCIENCE_ANIMALS = [
  { symbol: '🦁', word: 'Lion', amharic: 'አንበሳ (Anbessa)', desc: 'The brave king of the jungle with a golden mane.' },
  { symbol: '🐘', word: 'Elephant', amharic: 'ዝሆን (Zihon)', desc: 'The largest land animal, with big ears and a long trunk.' },
  { symbol: '🐕', word: 'Dog', amharic: 'ውሻ (Wusha)', desc: 'A loyal and playful friendly pet.' },
  { symbol: '🐈', word: 'Cat', amharic: 'ድመት (Dmet)', desc: 'A gentle, soft, and playful furry animal.' },
  { symbol: '🐄', word: 'Cow', amharic: 'ላም (Lam)', desc: 'Farm animal that gives delicious healthy milk.' },
  { symbol: '🐎', word: 'Horse', amharic: 'ፈረስ (Feres)', desc: 'A strong and fast-running animal with a flowing mane.' },
  { symbol: '🐑', word: 'Sheep', amharic: 'በግ (Beg)', desc: 'Gentle farm animal with warm fluffy wool.' },
  { symbol: '🐦', word: 'Bird', amharic: 'ወፍ (Wof)', desc: 'Feathered friend that sings songs and flies high in the sky.' },
  { symbol: '🐟', word: 'Fish', amharic: 'ዓሳ (Asa)', desc: 'Swims smoothly under water using fins and gills.' },
  { symbol: '🐒', word: 'Monkey', amharic: 'ጦጣ / ዝንጀሮ (Tota / Zinjero)', desc: 'Clever animal that loves climbing and swinging in trees.' },
  { symbol: '🦒', word: 'Giraffe', amharic: 'ቀጭኔ (Qechiné)', desc: 'Tall animal with a very long neck to reach high leaves.' },
  { symbol: '🦓', word: 'Zebra', amharic: 'የሜዳ አህያ (Yeméda Ahiya)', desc: 'Beautiful wild animal with black and white stripes.' },
];

export const SCIENCE_BODY_PARTS = [
  { symbol: '👁️', word: 'Eyes', amharic: 'አይኖች (Aynoch)', desc: 'Sense organ used for seeing colors, shapes, and books.' },
  { symbol: '👂', word: 'Ears', amharic: 'ጆሮዎች (Jorowoch)', desc: 'Sense organ used for hearing sounds, music, and voices.' },
  { symbol: '👃', word: 'Nose', amharic: 'አፍንጫ (Afncha)', desc: 'Sense organ used for smelling sweet flowers and food.' },
  { symbol: '👄', word: 'Mouth', amharic: 'አፍ (Af)', desc: 'Used for smiling, talking, singing, and tasting food.' },
  { symbol: '✋', word: 'Hands', amharic: 'እጆች (Ejoch)', desc: 'Used for holding toys, clapping, drawing, and writing.' },
  { symbol: '🦶', word: 'Feet', amharic: 'እግሮች (Igroch)', desc: 'Used for standing tall, walking, jumping, and running.' },
  { symbol: '🦷', word: 'Teeth', amharic: 'ጥርሶች (Tirsoch)', desc: 'Used for chewing healthy foods and giving bright smiles.' },
  { symbol: '🧠', word: 'Head & Brain', amharic: 'ራስና አእምሮ (Rasina Aemro)', desc: 'Where thinking, learning, and dreaming happen.' },
];

export const SCIENCE_NATURE_FOOD = [
  { symbol: '🍎', word: 'Apple', amharic: 'ፖም (Pom)', desc: 'Crisp, sweet, and healthy red or green fruit.' },
  { symbol: '🍌', word: 'Banana', amharic: 'ሙዝ (Muz)', desc: 'Sweet yellow fruit packed with energy.' },
  { symbol: '🥭', word: 'Mango', amharic: 'ማንጎ (Mango)', desc: 'Juicy tropical golden fruit.' },
  { symbol: '🍊', word: 'Orange', amharic: 'ብርቱካን (Birtukan)', desc: 'Juicy citrus fruit full of Vitamin C.' },
  { symbol: '☀️', word: 'Sun', amharic: 'ፀሐይ (Tsehay)', desc: 'Gives planet Earth warm light and energy every day.' },
  { symbol: '🌧️', word: 'Rain', amharic: 'ዝናብ (Zinab)', desc: 'Water falling from clouds that helps plants and flowers grow.' },
  { symbol: '🌳', word: 'Tree', amharic: 'ዛፍ (Zaf)', desc: 'Tall leafy plant that gives shade, clean air, and fruit.' },
  { symbol: '🌸', word: 'Flower', amharic: 'አበባ (Abeba)', desc: 'Colorful and fragrant blooming plant.' },
  { symbol: '💧', word: 'Water', amharic: 'ውሃ (Wuha)', desc: 'Fresh clean liquid all living things need to stay healthy.' },
  { symbol: '🏠', word: 'House', amharic: 'ቤት (Bét)', desc: 'Safe shelter where families live happily together.' },
];
