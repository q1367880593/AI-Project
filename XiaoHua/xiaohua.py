# coding:utf-8
from urllib.parse import urlencode
import requests
from lxml import etree
import re
import time

#import sys
#reload(sys)
#sys.setdefaultencoding("utf-8")
 

def downLoadPage(page):
    url = page
    print("start RP :", page)
#    url = "https://movie.douban.com/"
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240"
 
    with requests.request('GET',url,headers = {'User-agent':ua}) as res:
        # print(res)
        res.encoding = res.apparent_encoding
        content = res.text          #获取HTML的内容

        dic = {}

        html = etree.HTML(content, parser=etree.HTMLParser(encoding='utf-8'))
        # print(html)
        # 获取标题

        sentences = html.xpath("//div[@id='content']/text()")

        # dic["title"] = sentences[0]

        

        # 获取下一章链接
        nextChapter = html.xpath("//div[@class='page_chapter']//a")
        # print(nextChapter)
        if len(nextChapter)>3:
            next = nextChapter[2]
            herf = next.get("href")
            dic["nextHerf"] = herf
            # print(herf)
        else:
            dic["nextHerf"] = ""
        


        # 获取章节文
        chapterText = ""

        for sentence in sentences:
            chapterText += '\n'
            chapterText += sentence
        
        # print(chapterText)
        
        dic["content"] = chapterText
        return dic
#        return
##        print(brs)
#
##        for br in brs:
##            print(br.attrib)
##
##        return
#        ccc = orders[4]
##        print(etree.tostring(ccc, pretty_print=True))
##        print(ccc.text)
##        print(ccc.attrib)
#        txt_arr = ccc.xpath("//*/text()")
#
#        str = ""
#        occor = 0
#        start = 0
#        for t in txt_arr:
#            if t == "read_1_3();":
#                start = 1
#                continue
#            if t == "投推荐票":
#                occor += 1
##            if t == ";bdshare();":
##                break
#
#            if occor == 1 and start==1:
#                str += t
##        s1 = etree.tostring(ccc).decode('utf-8').encoding('gbk')
##        s1 = ccc.strip().encode('gbk', 'ignore')
##        print(s1)
#
#        str = str.replace('read3();bdshare();', '')
#        return str
    
#downLoadPage(1)



if __name__ == '__main__':
    # baseURL = "http://www.tycqzw.net"
    # baseURL = "https://www.zmccx.com"
    # baseURL = "https://www.xqianqian.net"
# https://www.bqwxg.com/wenzhang/62/62103/125675785.html
    
    # baseURL = "http://wap.tycqzw.net"
    baseURL = 'https://www.xqianqian.com'
    baseURL = 'http://www.xqianqianwx.cc'
# https://www.xqianqian.com/4/4127/25209293.html
    herf = '/0_845/54097231.html' # cur 11059
    herf = '/0_845/59917517.html' # cur 11741
    herf = '/0_845/62889154.html' # cur 12001
    

    herf = '/4/4127/25209293.html'# cur 12001
    
    
    herf = '/4/4127/25209340.html'# cur 11954
    idx = 11954
    herf = '/4/4127/25209108.html'# cur 12186
    idx = 12186

    herf = '/4/4127/23809820.html'# cur 12352
    idx = 12352


    herf = '/4/4127/43676193.html'# cur 12502
    idx = 12502
    
    
    herf = '/4/4127/43453443.html'# cur 12517
    idx = 12517

    
    # cur
    herf = '/4/4127/38117502.html'
    idx = 12869


    
# https://www.xqianqian.com/4/4127/25209340.html  #11954

    
#    str = ""
    for i in range(1000):
        time.sleep(66)
        chapterDic = downLoadPage(baseURL+herf)
        # title = chapterDic["title"]
        # title = title.strip()
        # print(chapterDic['content'])

        z = '第' + str(idx) + '章'

        content = chapterDic["content"].replace(' >  >  >', '').replace('←  →', '').replace('热门推荐：', '').replace('&nbsp;', '').replace('推荐都市大神老施新书:', '').replace('('+baseURL+herf+')', '').replace('1秒记住千千小说：www.xqianqian.net。手机版阅读网址：m.xqianqian.net', '').replace('<div  class="contentadv">', '').replace(z, '').replace('1秒记住千千小说：www.xqianqian.com。手机版阅读网址：m.xqianqian.com','').replace('(https://www.vxqianqian.cc/4/4127/25209293.html)','')
        # print('=========================================================================================================')
        # print(content)
        # if len(title)<=8: 
        #     t = title
        #     content = content.replace(title, '')
        #     title = title + ' 作者懒得起名'
        #     content = title + '\n' + content
        title = '第' + str(idx) + '章 作者懒得起名'
        content = title + '\n' + content
        idx += 1
        

        print("title==>",title)
        fileName = "xiaohua/"+title+".txt"
        fileName = fileName.strip()
        
        
        
        
        
        if title != "dad":
            f = open(fileName,'w')
            f.write(content)
            f.close()
        
        nextHerf = chapterDic["nextHerf"]
        print("next==>",nextHerf)

        if nextHerf.find('.html')>=0:
            herf = chapterDic["nextHerf"]