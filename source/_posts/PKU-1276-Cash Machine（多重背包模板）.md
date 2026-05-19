---
title: PKU-1276-Cash Machine（多重背包模板）
copyright_type: original
comments: true
date: '2016-08-20 15:30:52'
tags:
- pku
- acm
- 多重背包
categories:
- ACM
abbrlink: 6943597f
updated: '2016-08-20 15:30:52'
---

Cash Machine 

**Time Limit:** 1000MS|  | **Memory Limit:** 10000K  
---|---|---  
**Total Submissions:** 32967|  | **Accepted:** 11948  
  
Description

A Bank plans to install a machine for cash withdrawal. The machine is able to deliver appropriate @ bills for a requested cash amount. The machine uses exactly N distinct bill denominations, say Dk, k=1,N, and for each denomination Dk the machine has a supply of nk bills. For example,   
  
N=3, n1=10, D1=100, n2=4, D2=50, n3=5, D3=10   
  
means the machine has a supply of 10 bills of @100 each, 4 bills of @50 each, and 5 bills of @10 each.   
  
Call cash the requested amount of cash the machine should deliver and write a program that computes the maximum amount of cash less than or equal to cash that can be effectively delivered according to the available bill supply of the machine.   
  
Notes:   
@ is the symbol of the currency delivered by the machine. For instance, @ may stand for dollar, euro, pound etc.   


Input

The program input is from standard input. Each data set in the input stands for a particular transaction and has the format:   
  
cash N n1 D1 n2 D2 ... nN DN   
  
where 0 <= cash <= 100000 is the amount of cash requested, 0 <=N <= 10 is the number of bill denominations and 0 <= nk <= 1000 is the number of available bills for the Dk denomination, 1 <= Dk <= 1000, k=1,N. White spaces can occur freely between the numbers in the input. The input data are correct.   


Output

For each set of data the program prints the result to the standard output on a separate line as shown in the examples below.   


Sample Input
    
    
    735 3  4 125  6 5  3 350
    633 4  500 30  6 100  1 5  0 1
    735 0
    0 3  10 100  10 50  10 10

Sample Output
    
    
    735
    630
    0
    0

Hint

The first data set designates a transaction where the amount of cash requested is @735. The machine contains 3 bill denominations: 4 bills of @125, 6 bills of @5, and 3 bills of @350. The machine can deliver the exact amount of requested cash.   
  
In the second case the bill supply of the machine does not fit the exact amount of cash requested. The maximum cash that can be delivered is @630. Notice that there can be several possibilities to combine the bills in the machine for matching the delivered cash.   
  
In the third case the machine is empty and no cash is delivered. In the fourth case the amount of cash requested is @0 and, therefore, the machine delivers no cash. 

Source

[Southeastern Europe 2002](http://poj.org/searchproblem?field=source&key=Southeastern+Europe+2002)

  

    
    
    /**
    * @Author: Simon
    * @Date:   2016-07-26 09-25-15
    * @Project: ACM
    * @Last modified by:   Simon
    * @Last modified time: 2016-08-20 01-36-50
    */
    /*
            ┆ ┏┓　　　┏┓ ┆
            ┆┏┛┻━━━━━━┛┻┓  ┆
            ┆┃　　　　　 ┃ ┆
            ┆┃　    ━　　┃ ┆
            ┆┃　┳┛　┗┳  ┃ ┆
            ┆┃　　　　　 ┃ ┆
            ┆┃　　　┻　　┃ ┆
            ┆┗━┓　  　┏━┛ ┆
            ┆　┃　  　┃　　┆　　　　　　
            ┆　┃　  　┗━━━┓ ┆
            ┆　┃　 AC代马  ┣┓┆
            ┆　┃　        ┏┛┆
            ┆　┗┓┓ ┏━┳┓ ┏┛ ┆
            ┆　　┃┫┫　┃┫┫ ┆
            ┆　　┗┻┛　┗┻┛ ┆
    */
    
    #include <iostream>
    #include <cstdio>
    #include <cstring>
    #include <string>
    #include <cmath>
    #include <cstdlib>
    #include <stack>
    #include <deque>
    #include <queue>
    #include <map>
    #include <set>
    #include <vector>
    #include <algorithm>
    using namespace std;
    
    #define MAX 1000010
    #define PI (acos(-1.0))
    #define LL long long
    #define Swap(a, b) (a ^= b, b ^= a, a ^= b)
    #define Max(a,b) ((a)>(b)?(a):(b))
    #define Min(a,b) ((a)<(b)?(a):(b))
    #define Abs(a)  ((a)>0?(a):-(a))
    #define Fabs(a) ((a)>0?(a):-(a))
    
    const int INF = 0x3f3f3f3f;
    const LL INFL = 0x3f3f3f3f3f3f3f3fll;
    const LL MOD = 1000000007;
    
    LL gcd(LL a,LL b){return b==0?a:gcd(b,a%b);}
    void exgcd(LL a,LL b,LL &x,LL &y){if(!b){x=1;y=0;return;}exgcd(b,a%b,y,x);y-=x*(a/b);}
    LL ksm(LL a,LL b){
        LL res=1;
        a%=MOD;
        for(;b;b>>=1){
            if(b&1)res=res*a%MOD;
            a=a*a%MOD;
        }
        return res;
    }
    
    int a[MAX];
    bool flag[MAX];
    int main(){
        //freopen("in.txt","r",stdin);
        int n,i,j;
        LL sum;
        while(~scanf("%d",&n)){
            for(i=1;i<=n;i++){
                scanf("%d",a+i);
            }
            sum=0;
            for(i=n;i>=1;i--){
                if(a[i]>=0) sum++;
                else{
                    LL tmp=a[i];
                    for(j=i-1;j>=1;j--){
                        tmp+=a[j];
                        if(tmp>=0){
                            sum++;
                            i=j;
                            break;
                        }
                    }
                }
            }
            printf("%lld\n",sum);
        }
        return 0;
    }
    
    /*
                       _ooOoo_
                      o8888888o
                      88" . "88
                      (| -_- |)
                      O\  =  /O
                   ____/`---'\____
                 .'  \\|     |//  `.
                /  \\|||  :  |||//  \
               /  _||||| -:- |||||-  \
               |   | \\\  -  /// |   |
               | \_|  ''\---/''  |   |
               \  .-\__  `-`  ___/-. /
             ___`. .'  /--.--\  `. . __
          ."" '<  `.___\_<|>_/___.'  >'"".
         | | :  `- \`.;`\ _ /`;.`/ - ` : | |
         \  \ `-.   \_ __\ /__ _/   .-` /  /
    ======`-.____`-.___\_____/___.-`____.-'======
                       `=---='
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                佛祖保佑       BUG全无
                佛祖镇楼       AC永驻
    */
