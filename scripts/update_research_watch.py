#!/usr/bin/env python3
import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research-watch" / "research-data.json"
UA = "sarah-research-watch/1.0"
TIMEOUT = 20
MAX_ITEMS = 300

QUERIES = {
    "arxiv": '(cat:cs.AI OR cat:cs.RO OR cat:cs.HC) AND (robot OR "human robot" OR assistive OR accessibility OR disability OR rehabilitation OR "large language model" OR HRI)',
    "pubmed": '((assistive technology) OR (social robot) OR (human robot interaction) OR (rehabilitation robotics) OR (brain computer interface) OR (augmentative alternative communication) OR (artificial intelligence AND disability))',
    "hal": '("robotique sociale" OR "interaction humain robot" OR "aide technique" OR handicap OR "intelligence artificielle" OR rééducation OR neurotechnologie)'
}

def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/xml,text/xml,application/json"})
    with urllib.request.urlopen(req,timeout=TIMEOUT) as r:
        return r.read()

def clean(s):
    s=re.sub(r"<[^>]+>"," ",s or "")
    return re.sub(r"\s+"," ",html.unescape(s)).strip()

def text(node,name,ns=""):
    child=node.find(f"{ns}{name}")
    return clean(child.text) if child is not None and child.text else ""

def classify(title,summary):
    s=(title+" "+summary).lower()
    rules=[
      ("Robotique sociale & HRI",["social robot","human-robot","human robot","hri","robot social","interaction humain robot"]),
      ("Robotique d’assistance",["assistive robot","rehabilitation robot","robotic rehabilitation","exoskeleton","prosthe","orthos","robot d'assistance"]),
      ("Aides techniques",["assistive technolog","aide technique","augmentative","alternative communication","aac","caa","wheelchair"]),
      ("Neurotechnologies",["brain-computer","brain computer","bci","neurotechn","eeg"]),
      ("IA & LLM",["large language model"," llm","artificial intelligence","intelligence artificielle","generative ai","machine learning"]),
      ("IHM & UX",["human-computer","hci","interface","interaction homme","user experience","accessibility"]),
      ("Rééducation",["rehabilitation","rééducation","therapy","motor recovery"]),
      ("Handicap & société",["disability","disabled","handicap","inclusion"]),
    ]
    found=[name for name,keys in rules if any(k in s for k in keys)]
    return found or ["Recherche & technologies"]

def relevant(title,summary):
    s=(title+" "+summary).lower()
    terms=["robot","assistive","accessib","disabil","handicap","rehabil","rééduc","neuro","brain-computer","brain computer","bci","human-computer","human robot","human-robot","hri","augmentative","alternative communication","llm","large language model","artificial intelligence","intelligence artificielle"]
    return any(t in s for t in terms)

def arxiv():
    q=urllib.parse.urlencode({"search_query":QUERIES["arxiv"],"start":0,"max_results":60,"sortBy":"submittedDate","sortOrder":"descending"})
    root=ET.fromstring(get("https://export.arxiv.org/api/query?"+q))
    ns="{http://www.w3.org/2005/Atom}"
    out=[]
    for e in root.findall(ns+"entry"):
        title=text(e,"title",ns); summary=text(e,"summary",ns)
        if not relevant(title,summary): continue
        url=text(e,"id",ns)
        authors=[text(a,"name",ns) for a in e.findall(ns+"author")]
        out.append({"title":title,"url":url,"source":"arXiv","type":"Preprint","published":text(e,"published",ns),"authors":authors[:8],"domains":classify(title,summary),"keywords":[],"summary":summary[:650]})
    return out

def pubmed():
    params=urllib.parse.urlencode({"db":"pubmed","term":QUERIES["pubmed"],"retmode":"json","retmax":50,"sort":"pub date"})
    search=json.loads(get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?"+params).decode())
    ids=search.get("esearchresult",{}).get("idlist",[])
    if not ids:return []
    xml=ET.fromstring(get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?"+urllib.parse.urlencode({"db":"pubmed","id":",".join(ids),"retmode":"xml"})))
    out=[]
    for a in xml.findall(".//PubmedArticle"):
        pmid=text(a.find(".//PMID") if a.find(".//PMID") is not None else a,"PMID") or clean(a.findtext(".//PMID"))
        title=clean("".join(a.find(".//ArticleTitle").itertext())) if a.find(".//ArticleTitle") is not None else ""
        abstracts=["".join(x.itertext()) for x in a.findall(".//Abstract/AbstractText")]
        summary=clean(" ".join(abstracts))
        if not relevant(title,summary):continue
        year=clean(a.findtext(".//PubDate/Year") or a.findtext(".//ArticleDate/Year") or "")
        published=(year+"-01-01T00:00:00Z") if year else None
        journal=clean(a.findtext(".//Journal/Title") or "PubMed")
        out.append({"title":title,"url":"https://pubmed.ncbi.nlm.nih.gov/"+pmid+"/","source":journal,"type":"Publication scientifique","published":published,"domains":classify(title,summary),"keywords":[],"summary":summary[:650]})
    return out

def hal():
    params=urllib.parse.urlencode({"q":QUERIES["hal"],"fl":"title_s,uri_s,producedDate_tdate,abstract_s,keyword_s,docType_s","rows":60,"sort":"producedDate_tdate desc","wt":"json"})
    data=json.loads(get("https://api.archives-ouvertes.fr/search/?"+params).decode())
    out=[]
    for d in data.get("response",{}).get("docs",[]):
        title=d.get("title_s",""); title=title[0] if isinstance(title,list) else title
        summary=d.get("abstract_s",""); summary=summary[0] if isinstance(summary,list) else summary
        if not relevant(title,summary):continue
        out.append({"title":clean(title),"url":d.get("uri_s","https://hal.science/"),"source":"HAL","type":"Publication scientifique","published":d.get("producedDate_tdate"),"domains":classify(title,summary),"keywords":d.get("keyword_s",[])[:10] if isinstance(d.get("keyword_s",[]),list) else [],"summary":clean(summary)[:650]})
    return out

def main():
    existing=json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"items":[]}
    by_url={x.get("url"):x for x in existing.get("items",[]) if x.get("url") and x.get("source")!="Workspace"}
    errors=[]
    for name,fn in [("arXiv",arxiv),("PubMed",pubmed),("HAL",hal)]:
        try:
            for item in fn(): by_url[item["url"]]=item
        except Exception as e:
            errors.append({"source":name,"error":str(e)[:200]})
    items=sorted(by_url.values(),key=lambda x:x.get("published") or "",reverse=True)[:MAX_ITEMS]
    OUT.write_text(json.dumps({"updatedAt":now_iso(),"errors":errors,"items":items},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

if __name__=="__main__":
    main()
