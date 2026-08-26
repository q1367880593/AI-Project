# coding:utf-8
import requests
from lxml import etree
import time


def downLoadPage(page):
    url = page
    print("start RP :", page)
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240"
 
    with requests.request('GET',url,headers = {'User-agent':ua}) as res:
        res.encoding = res.apparent_encoding
        content = res.text          #获取HTML的内容

        dic = {}

        html = etree.HTML(content, parser=etree.HTMLParser(encoding='utf-8'))
        # 获取正文
        sentences = html.xpath("//div[@id='content']/text()")

        

        # 获取下一章链接
        nextChapter = html.xpath("//div[@class='page_chapter']//a")
        if len(nextChapter)>3:
            next = nextChapter[2]
            herf = next.get("href")
            dic["nextHerf"] = herf
        else:
            dic["nextHerf"] = ""
        


        # 获取章节文
        chapterText = ""

        for sentence in sentences:
            chapterText += '\n'
            chapterText += sentence

        dic["content"] = chapterText
        return dic


if __name__ == '__main__':
    baseURL = 'http://www.xqianqianwx.cc'
# 起始章节地址与章号（续爬时修改这两行）
    herf = '/4/4127/38117502.html'
    idx = 12869
    for i in range(1000):
        time.sleep(66)
        chapterDic = downLoadPage(baseURL+herf)

        z = '第' + str(idx) + '章'

        content = chapterDic["content"].replace(' >  >  >', '').replace('←  →', '').replace('热门推荐：', '').replace('&nbsp;', '').replace('推荐都市大神老施新书:', '').replace('('+baseURL+herf+')', '').replace('1秒记住千千小说：www.xqianqian.net。手机版阅读网址：m.xqianqian.net', '').replace('<div  class="contentadv">', '').replace(z, '').replace('1秒记住千千小说：www.xqianqian.com。手机版阅读网址：m.xqianqian.com','').replace('(https://www.vxqianqian.cc/4/4127/25209293.html)','')
        title = '第' + str(idx) + '章 作者懒得起名'
        content = title + '\n' + content
        idx += 1
        

        print("title==>",title)
        fileName = "xiaohua/"+title+".txt"
        fileName = fileName.strip()
        
        
        
        
        
        f = open(fileName,'w')
        f.write(content)
        f.close()
        
        nextHerf = chapterDic["nextHerf"]
        print("next==>",nextHerf)

        if nextHerf.find('.html')>=0:
            herf = chapterDic["nextHerf"]