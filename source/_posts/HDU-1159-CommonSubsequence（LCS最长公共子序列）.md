---
title: HDU-1159-CommonSubsequence（LCS最长公共子序列）
comments: true
date: '2016-08-20 15:51:37'
tags:
- hdu
- LCS
- 最长公共子序列
categories:
- ACM
abbrlink: 4d4e6c90
updated: '2016-08-20 15:51:37'
---

##  Common Subsequence

**Time Limit: 2000/1000 MS (Java/Others) Memory Limit: 65536/32768 K (Java/Others)  
Total Submission(s): 34353 Accepted Submission(s): 15683  
**   
  


Problem Description 

A subsequence of a given sequence is the given sequence with some elements (possible none) left out. Given a sequence X = <x1, x2, ..., xm> another sequence Z = <z1, z2, ..., zk> is a subsequence of X if there exists a strictly increasing sequence <i1, i2, ..., ik> of indices of X such that for all j = 1,2,...,k, xij = zj. For example, Z = <a, b, f, c> is a subsequence of X = <a, b, c, f, b, c> with index sequence <1, 2, 4, 6>. Given two sequences X and Y the problem is to find the length of the maximum-length common subsequence of X and Y.   
The program input is from a text file. Each data set in the file contains two strings representing the given sequences. The sequences are separated by any number of white spaces. The input data are correct. For each set of data the program prints on the standard output the length of the maximum-length common subsequence from the beginning of a separate line.   


  


Sample Input 
    
    
      
    
    
       abcfbc abfcab
    programming contest 
    abcd mnp
      

  


Sample Output 
    
    
      
    
    
       4
    2
    0
      

  


Source 

[Southeastern Europe 2003](http://acm.split.hdu.edu.cn/search.php?field=problem&key=Southeastern+Europe+2003&source=1&searchmode=source)

  


LCS-最长公共子序列  

    
    
    #include <cstdio>
    #include <cstring>
    
    int a[1010][1010];
    int LCS(char *s1,char *s2){
        int m=strlen(s1),n=strlen(s2);
        int i,j;
        a[0][0]=0;
        for(i=1;i<=m;i++) a[i][0]=0;
        for(i=1;i<=n;i++) a[0][i]=0;
        for(i=1;i<=m;i++){
            for(j=1;j<=n;j++){
                if(s1[i-1]==s2[j-1]) a[i][j] = a[i-1][j-1]+1;
                else if(a[i-1][j]>a[i][j-1]) a[i][j]=a[i-1][j];
                else a[i][j]=a[i][j-1];
            }
        }
        return a[m][n];
    }
    char s1[1010],s2[1010];
    int main(){
        //freopen("in.txt","r",stdin);
        while(~scanf("%s%s",s1,s2)){
            printf("%d\n",LCS(s1,s2));
        }
        return 0;
    }
