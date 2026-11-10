// ============================================================
//  CONVERSATION QUESTIONS  — data for /questions/<slug>
// ============================================================
//  Each entry becomes one static page: a free, no-signup list of
//  discussion questions for adult learners, linked to the real
//  lessons on that topic. These pages target the biggest free-intent
//  query family in the niche ("ESL conversation questions about X").
//
//  Rules:
//   - 6 questions per group, 4 groups per page (24 total)
//   - never yes/no-only; every question should force an opinion,
//     a story or a comparison
//   - B1-C1 friendly: no idioms that need explaining, no culture
//     references that only one country would get
//   - keep "topic" equal to a key in topicLabels in generate-lessons.js
// ============================================================

const conversationQuestions = [

    {
        slug: 'psychology',
        topic: 'psychology',
        title: 'ESL Conversation Questions About Psychology',
        heading: 'ESL Conversation Questions About Psychology',
        intro: 'Twenty-four questions about fear, habits, personality and memory — the kind of psychology that adults argue about over coffee. No theory, no jargon, just things people have opinions about.',
        meta: '24 free ESL conversation questions about psychology: fear, habits, personality and memory. For B1-C1 adults. No signup, no download.',
        groups: [
            {
                heading: 'Fears and anxiety',
                items: [
                    'What is the strangest thing you have ever been afraid of?',
                    'Do you think fear is ever useful? When has fear protected you?',
                    'Why do some people enjoy horror films and others cannot watch them?',
                    'What do you do when you cannot sleep because you are worrying?',
                    'Is anxiety talked about more openly now than when you were a child?',
                    'Would you rather be fearless or cautious for the rest of your life?'
                ]
            },
            {
                heading: 'Habits and willpower',
                items: [
                    'What habit did you try to break, and how long did you last?',
                    'Why is it easy to start something in January and impossible by March?',
                    'Do you trust people who say they have no bad habits?',
                    'What small habit has improved your life more than any big decision?',
                    'Does willpower actually exist, or is it just a good night\u2019s sleep?',
                    'What would you do differently if you had unlimited discipline for one month?'
                ]
            },
            {
                heading: 'Personality and self-image',
                items: [
                    'How different is the person you are at work from the person you are at home?',
                    'Do personality tests tell you anything true, or are they just flattering?',
                    'What do people usually get wrong about you when they first meet you?',
                    'Can people genuinely change, or do they only get better at hiding?',
                    'Which compliment do you find hardest to accept?',
                    'If a friend described you in three words, what would you hope they were?'
                ]
            },
            {
                heading: 'Memory and perception',
                items: [
                    'What is your earliest memory, and how much of it do you trust?',
                    'Why do we remember embarrassing moments so much better than happy ones?',
                    'Have you ever completely changed your mind about a person? What happened?',
                    'Do you think two people can remember the same event correctly but differently?',
                    'What do you deliberately choose not to remember?',
                    'If you could delete one memory, would you?'
                ]
            }
        ]
    },

    {
        slug: 'society',
        topic: 'society',
        title: 'ESL Conversation Questions About Society',
        heading: 'ESL Conversation Questions About Society',
        intro: 'Class, manners, generations and belonging — questions that split a room in half within thirty seconds. Useful for B1-C1 groups who are bored of safe topics.',
        meta: '24 free ESL conversation questions about society: class, manners, generations and belonging. For B1-C1 adult learners. No signup needed.',
        groups: [
            {
                heading: 'Status and class',
                items: [
                    'Can you tell someone\u2019s social class from the way they speak?',
                    'Is it rude to ask what someone does for a living?',
                    'Does money buy respect in your country, or does something else?',
                    'What is the most obvious sign that someone grew up wealthy?',
                    'Would you rather be respected or liked?',
                    'Is social mobility really possible, or is it a story we tell?'
                ]
            },
            {
                heading: 'Rules and rudeness',
                items: [
                    'What behaviour is normal in your country but rude somewhere else?',
                    'Where is the line between being direct and being rude?',
                    'Do people follow rules because they agree with them or because they are watched?',
                    'What rule in your country would you abolish tomorrow?',
                    'Is it ever acceptable to lie to be polite?',
                    'What is the rudest thing a stranger has done to you?'
                ]
            },
            {
                heading: 'Generations',
                items: [
                    'Which generation had it hardest, and why?',
                    'What does the older generation misunderstand about yours?',
                    'What do younger people get wrong about being older?',
                    'Do you feel your age, or does the number surprise you?',
                    'What did you believe at twenty that you find ridiculous now?',
                    'Which generational complaint is actually justified?'
                ]
            },
            {
                heading: 'Belonging and outsiders',
                items: [
                    'What makes someone an outsider in a group?',
                    'Have you ever been the only foreigner in a room? How did it feel?',
                    'Do people need a community, or can they be happy alone?',
                    'What is the difference between being lonely and being alone?',
                    'Which group do you belong to that you never chose?',
                    'Would you rather fit in completely or stand out slightly?'
                ]
            }
        ]
    },

    {
        slug: 'technology',
        topic: 'technology',
        title: 'ESL Conversation Questions About Technology',
        heading: 'ESL Conversation Questions About Technology',
        intro: 'Phones, AI, privacy and the strange things we now do without thinking. These questions work for B1 and above, and they never run dry.',
        meta: '24 free ESL conversation questions about technology: phones, AI, privacy and attention. For B1-C1 adults. No signup, no download.',
        groups: [
            {
                heading: 'Phones and attention',
                items: [
                    'How many times a day do you check your phone without deciding to?',
                    'What was the last thing you did that used to require a phone but no longer does?',
                    'Do you feel anxious when your battery is below twenty percent?',
                    'Should children be allowed smartphones before secondary school?',
                    'What do you miss about life before smartphones?',
                    'If you had to delete every app except three, which three survive?'
                ]
            },
            {
                heading: 'Artificial intelligence',
                items: [
                    'Have you used AI for something you would be embarrassed to admit?',
                    'Would you trust an AI doctor more than a tired human one?',
                    'What job do you think AI will never do well?',
                    'If your boss replaced you with AI, would you be angry or impressed?',
                    'Should AI-generated content be labelled? Would you notice anyway?',
                    'What would you ask an AI if it could answer only one question honestly?'
                ]
            },
            {
                heading: 'Privacy',
                items: [
                    'What do you accept without reading, and why?',
                    'Is privacy already dead, or do we just not care enough?',
                    'Would you trade your data for a genuinely better service?',
                    'What would you refuse to share, even for money?',
                    'Do you cover your laptop camera? Be honest.',
                    'Who has more information about you, your government or a tech company?'
                ]
            },
            {
                heading: 'Digital life versus real life',
                items: [
                    'Is an online friendship a real friendship?',
                    'What did the internet make better about your life?',
                    'What did it quietly make worse?',
                    'Would you rather lose your phone for a week or your bank card?',
                    'Are people more honest online or offline?',
                    'What will be normal in ten years that sounds absurd today?'
                ]
            }
        ]
    },

    {
        slug: 'work',
        topic: 'work',
        title: 'ESL Conversation Questions About Work',
        heading: 'ESL Conversation Questions About Work',
        intro: 'Careers, bosses, remote work and quitting — the questions adults actually answer honestly. Good for Business English lessons that should not feel like a meeting.',
        meta: '24 free ESL conversation questions about work: careers, bosses, remote work and quitting. For B1-C1 adults and Business English.',
        groups: [
            {
                heading: 'Career choices',
                items: [
                    'How did you end up doing what you do?',
                    'What did you want to be at twelve, and what happened to that plan?',
                    'Would you rather do something boring but secure or something exciting but unstable?',
                    'Is it realistic to love your job?',
                    'What job would you do for free for a year?',
                    'Do you work to live or live to work?'
                ]
            },
            {
                heading: 'Bosses and colleagues',
                items: [
                    'What makes a manager worth respecting?',
                    'Have you ever had a boss you genuinely liked? What did they do differently?',
                    'Is it possible to be friends with your boss?',
                    'What office behaviour should be illegal but is not?',
                    'How do you deal with a colleague who talks too much?',
                    'Would you rather work with someone brilliant and unpleasant, or average and kind?'
                ]
            },
            {
                heading: 'Remote work',
                items: [
                    'Are you more productive at home or in an office?',
                    'What do you actually miss about the office?',
                    'Should employers be allowed to track remote workers?',
                    'Is working from home better for families, or just better for some families?',
                    'What is the ideal number of days in the office?',
                    'Would you take a pay cut to work remotely forever?'
                ]
            },
            {
                heading: 'Quitting and ambition',
                items: [
                    'What would make you quit a job with no backup plan?',
                    'Is job-hopping smart or suspicious?',
                    'What does ambition look like when nobody is watching?',
                    'Have you ever been relieved to be rejected?',
                    'What is the most useful thing you learned from a job you hated?',
                    'If money were solved, what would you do with your working hours?'
                ]
            }
        ]
    },

    {
        slug: 'life',
        topic: 'life',
        title: 'ESL Conversation Questions About Relationships',
        heading: 'ESL Conversation Questions About Relationships',
        intro: 'Friendship, family, dating and long-term love — 24 questions that get past "do you have a big family?" and into something people actually want to talk about.',
        meta: '24 free ESL conversation questions about relationships: friendship, family, dating and long-term love. For B1-C1 adults. No signup.',
        groups: [
            {
                heading: 'Friendships',
                items: [
                    'How many real friends do you have, honestly?',
                    'What is the difference between a friend and a good acquaintance?',
                    'Can men and women be close friends without complications?',
                    'What would make you end a friendship you have had for years?',
                    'Do friendships need effort, or do the real ones survive neglect?',
                    'Who is the person you would call at three in the morning?'
                ]
            },
            {
                heading: 'Family',
                items: [
                    'What is the most useful thing your parents taught you by accident?',
                    'Do you become more like your parents as you get older?',
                    'Is it possible to be too close to your family?',
                    'Who in your family do you understand better now than five years ago?',
                    'Should adult children live with their parents longer?',
                    'What family tradition would you keep, and what would you quietly drop?'
                ]
            },
            {
                heading: 'Dating',
                items: [
                    'What is the most important quality in a partner?',
                    'Have dating apps made people more or less honest?',
                    'What is a deal-breaker that others find unreasonable?',
                    'Is it better to be loved or understood?',
                    'Do people date differently at twenty and at forty?',
                    'What is the worst first-date question you have been asked?'
                ]
            },
            {
                heading: 'Long-term relationships',
                items: [
                    'What kills relationships faster than cheating?',
                    'Is routine the enemy of romance?',
                    'Should couples share money completely?',
                    'What do people misunderstand about arranged marriages?',
                    'Can a relationship survive living in different countries?',
                    'What is the one conversation couples avoid for too long?'
                ]
            }
        ]
    },

    {
        slug: 'travel',
        topic: 'travel',
        title: 'ESL Conversation Questions About Travel',
        heading: 'ESL Conversation Questions About Travel',
        intro: 'Why we travel, how we behave when we do, and what we refuse to admit about being tourists. Twenty-four questions with plenty of storytelling built in.',
        meta: '24 free ESL conversation questions about travel: why we travel, tourists, bad trips and living abroad. For B1-C1 adults. No signup.',
        groups: [
            {
                heading: 'Why we travel',
                items: [
                    'What are you actually looking for when you travel?',
                    'Do you travel to rest, to learn, or to take photos?',
                    'Is travel a hobby, an escape or a status symbol?',
                    'What is the cheapest trip that changed you?',
                    'Would you rather travel alone, with a partner or with friends?',
                    'How many countries have you been to, and does that number matter?'
                ]
            },
            {
                heading: 'Tourists versus travellers',
                items: [
                    'What is the difference between a tourist and a traveller?',
                    'Is any of us really a traveller any more?',
                    'Is Overtourism a local problem or a traveller\u2019s problem?',
                    'What behaviour abroad should be fined?',
                    'Should you learn the language if you stay a week?',
                    'What place was ruined for you by the other visitors?'
                ]
            },
            {
                heading: 'Bad trips',
                items: [
                    'What is the worst trip you have ever taken?',
                    'Have you ever been seriously lost in another country?',
                    'What food did you regret trusting?',
                    'Do you remember disasters more fondly than perfect trips?',
                    'What would make you cancel a trip two days before?',
                    'Which travel problem is worse: no money, no time or no company?'
                ]
            },
            {
                heading: 'Living abroad',
                items: [
                    'Would you rather travel for a year or live abroad for six months?',
                    'What do people underestimate about moving to another country?',
                    'Which country would suit you, and which would defeat you?',
                    'How long does it take to feel at home somewhere?',
                    'When you move abroad, what do you miss that you did not expect?',
                    'Would you move abroad for love?'
                ]
            }
        ]
    },

    {
        slug: 'food',
        topic: 'food',
        title: 'ESL Conversation Questions About Food',
        heading: 'ESL Conversation Questions About Food',
        intro: 'Comfort food, eating habits, restaurants and the things people are quietly judgemental about. Reliable for almost any level above A2.',
        meta: '24 free ESL conversation questions about food: comfort eating, food culture, restaurants and cooking. For A2-C1 adults. No signup.',
        groups: [
            {
                heading: 'Comfort and habits',
                items: [
                    'What food do you eat when you are not OK, and what does it fix?',
                    'What do you eat every week because you were told it is healthy?',
                    'Which food from your childhood tastes different now?',
                    'Do you eat differently at home and alone than you would in front of others?',
                    'What is the most pointless diet you have tried?',
                    'If you had to eat one dish for a month, what would you choose?'
                ]
            },
            {
                heading: 'Food culture',
                items: [
                    'Which country has the most overrated food?',
                    'What is a normal food in your country that foreigners find shocking?',
                    'Does food belong to a nation, or is that just branding?',
                    'What is the strangest thing you have seen served with tea?',
                    'Should a national dish mean the same thing to everyone who makes it?',
                    'Which food tradition should disappear, and which should spread?'
                ]
            },
            {
                heading: 'Restaurants',
                items: [
                    'What is the right way to complain in a restaurant?',
                    'Is tipping fair to the customer, the waiter or neither?',
                    'Do you trust a restaurant with no reviews?',
                    'What makes a good waiter?',
                    'Would you rather eat somewhere brilliant and crowded or empty and average?',
                    'Have you ever left a restaurant because of the menu?'
                ]
            },
            {
                heading: 'Cooking and money',
                items: [
                    'Who in your household actually cooks, and why?',
                    'Is cooking a skill or a hobby?',
                    'Has food become too expensive, or have we become too picky?',
                    'What is worth paying extra for, and what is a waste?',
                    'Would you rather never cook again or never eat out again?',
                    'What dish do you make that would annoy a chef?'
                ]
            }
        ]
    },

    {
        slug: 'media',
        topic: 'media',
        title: 'ESL Conversation Questions About Media',
        heading: 'ESL Conversation Questions About Media',
        intro: 'Fame, news, algorithms and what we actually watch. These questions work for everyone, and everyone answers them differently.',
        meta: '24 free ESL conversation questions about media: fame, news, algorithms and taste. For B1-C1 adult learners. No signup, no download.',
        groups: [
            {
                heading: 'Fame',
                items: [
                    'Would you accept being famous if you had no money from it?',
                    'What do people want when they want to be famous?',
                    'Which celebrity would you be curious to have dinner with?',
                    'Is it fair to criticise someone\u2019s life choices when they chose fame?',
                    'Who is the most famous person in your country, and what is that based on?',
                    'Would you rather be respected by a hundred people or known by a million?'
                ]
            },
            {
                heading: 'News',
                items: [
                    'How do you find out something important actually happened?',
                    'Do you trust any single news source completely?',
                    'Is the news a service or a business?',
                    'What story do you think is underreported?',
                    'What is the difference between an opinion and a lie?',
                    'Would you pay for news if nothing else worked?'
                ]
            },
            {
                heading: 'Feeds and algorithms',
                items: [
                    'What does your feed think you are interested in?',
                    'Have you ever changed something about your life because a feed showed it to you?',
                    'Is it wrong for a platform to decide what you feel like today?',
                    'What content do you consume that you would be embarrassed to explain?',
                    'Are we more divided because of social media, or just louder?',
                    'Should there be a limit on how much of your attention can be sold?'
                ]
            },
            {
                heading: 'Film, music and taste',
                items: [
                    'What film or album will always be part of who you are?',
                    'Is taste in music about a person or about their age?',
                    'Does anything deserve a remake?',
                    'Why do adults care what teenagers listen to?',
                    'What is too popular to be good, in your opinion?',
                    'Would you rather discover something new or revisit something you love?'
                ]
            }
        ]
    }

];

module.exports = conversationQuestions;
