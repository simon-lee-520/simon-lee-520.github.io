---
title: HDU-1097-A hard puzzle（快速幂）
comments: true
date: '2016-08-20 15:42:36'
tags:
- hdu
- 快速幂
categories:
- ACM
abbrlink: 63ec317d
updated: '2016-08-20 15:42:36'
---

##  A hard puzzle

**Time Limit: 2000/1000 MS (Java/Others) Memory Limit: 65536/32768 K (Java/Others)  
Total Submission(s): 39822 Accepted Submission(s): 14354  
**  
  


Problem Description

lcy gives a hard puzzle to feng5166,lwg,JGShining and Ignatius: gave a and b,how to know the a^b.everybody objects to this BT problem,so lcy makes the problem easier than begin.  
this puzzle describes that: gave a and b,how to know the a^b's the last digit number.But everybody is too lazy to slove this problem,so they remit to you who is wise.  


  


Input

There are mutiple test cases. Each test cases consists of two numbers a and b(0<a,b<=2^30)  


  


Output

For each test case, you should output the a^b's last digit number.  


  


Sample Input
    
    
    7 66
    8 800

  


Sample Output
    
    
    9
    6

  


Author

eddy

  


快速幂模板。

  

    
    
    #include<iostream>
    using namespace std;
    typedef long long ll;
    void ksm(int a,int b){
        int r=1;
        int base=a%10;
        while(b){
            if(b&1){
                r=r*base%10;
            }
            base=base*base%10;
            b>>=1;
        }
        cout<<r%10<<endl;
    }
    int main(){
        int a,b;
        while(cin>>a>>b){
            ksm(a,b);
        }
        return 0;
    }
