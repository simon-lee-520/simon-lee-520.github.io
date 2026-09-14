---
title: PKU-2524-Ubiquitous Religions（并查集模板）
copyright_type: original
comments: true
date: '2016-08-20 15:34:39'
tags:
- pku
- 并查集
categories:
- ACM
abbrlink: 3b32fb51
updated: '2016-08-20 15:34:39'
---

Ubiquitous Religions 

**Time Limit:** 5000MS|  | **Memory Limit:** 65536K  
---|---|---  
**Total Submissions:** 32067|  | **Accepted:** 15530  
  
Description

There are so many different religions in the world today that it is difficult to keep track of them all. You are interested in finding out how many different religions students in your university believe in.   
  
You know that there are n students in your university (0 < n <= 50000). It is infeasible for you to ask every student their religious beliefs. Furthermore, many students are not comfortable expressing their beliefs. One way to avoid these problems is to ask m (0 <= m <= n(n-1)/2) pairs of students and ask them whether they believe in the same religion (e.g. they may know if they both attend the same church). From this data, you may not know what each person believes in, but you can get an idea of the upper bound of how many different religions can be possibly represented on campus. You may assume that each student subscribes to at most one religion. 

Input

The input consists of a number of cases. Each case starts with a line specifying the integers n and m. The next m lines each consists of two integers i and j, specifying that students i and j believe in the same religion. The students are numbered 1 to n. The end of input is specified by a line in which n = m = 0. 

Output

For each test case, print on a single line the case number (starting with 1) followed by the maximum number of different religions that the students in the university believe in. 

Sample Input
    
    
    10 9
    1 2
    1 3
    1 4
    1 5
    1 6
    1 7
    1 8
    1 9
    1 10
    10 4
    2 3
    4 5
    4 8
    5 8
    0 0
    

Sample Output
    
    
    Case 1: 1
    Case 2: 7
    

Hint

Huge input, scanf is recommended. 

Source

[Alberta Collegiate Programming Contest 2003.10.18](http://poj.org/searchproblem?field=source&key=Alberta+Collegiate+Programming+Contest+2003.10.18)

  


并查集模板。  


  

    
    
    #include <stdio.h>
    #include <string.h>
    #define MAX 50000
    int pre[MAX+10];
    int t[MAX+10];//t 用于标记独立块的根结点
    
    int find(int x){//查找根节点
        int r=x;
        int i=x,j;
        while(pre[r]!=r){
            r=pre[r];
        }
        as
        while(pre[i]!=r){//路径压缩
            j=pre[i];
            pre[i]=r;
            i=j;
        }
        return r;
    }
    void mix(int x,int y){//连通两个集合
        int fx=find(x),fy=find(y);
        if(fx!=fy)
            pre[fx]=fy;
    }
    int main(){
        int n,m,i;
        int x,y,s,ans=1;
        while(scanf("%d %d",&n,&m),n+m){
            s=0;
            for(i=0;i<n;i++)
                pre[i]=i;
            for(i=0;i<m;i++){
                scanf("%d %d",&x,&y);
                mix(x,y);
            }
    
            memset(t,0,sizeof(t));
            for(i=0;i<n;i++){//标记根节点
                t[find(i)]=1;
            }
            for(i=0;i<n;i++)
                if(t[i]==1)
                    s++;
            printf("Case %d: %d\n",ans++,s);
        }
        return 0;
    }
