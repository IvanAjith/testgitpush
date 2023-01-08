import pymongo

client = pymongo.MongoClient("mongodb+srv://ajithkhan:9789861061@cluster1.jc7p2iv.mongodb.net/?retryWrites=true&w=majority")
db = client.test
print(db)

d= {
    "FirstName" : "Ajith",
    "Emial" : "ajithkhan619@gmail.com",
    "Surname" : "Khan"
}

db1 = client['mongodb']
coll = db1['test']
coll.insert_one(d)