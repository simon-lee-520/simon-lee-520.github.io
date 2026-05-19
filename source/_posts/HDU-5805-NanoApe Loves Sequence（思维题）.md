---
title: HDU-5805-NanoApe Loves Sequence（思维题）
comments: true
date: '2016-08-20 15:56:22'
tags:
- hdu
categories:
- ACM
abbrlink: 4339848f
updated: '2016-08-20 15:56:22'
---

##  NanoApe Loves Sequence

**Time Limit: 2000/1000 MS (Java/Others) Memory Limit: 262144/131072 K (Java/Others)  
Total Submission(s): 1087 Accepted Submission(s): 448  
**   
  


Problem Description 

NanoApe, the Retired Dog, has returned back to prepare for the National Higher Education Entrance Examination!   
  
In math class, NanoApe picked up sequences once again. He wrote down a sequence with n numbers on the paper and then randomly deleted a number in the sequence. After that, he calculated the maximum absolute value of the difference of each two adjacent remained numbers, denoted as F.   
  
Now he wants to know the expected value of F, if he deleted each number with equal probability. 

  


Input 

The first line of the input contains an integer T, denoting the number of test cases.  
  
In each test case, the first line of the input contains an integer n, denoting the length of the original sequence.  
  
The second line of the input contai ns n integers  A1,A2,...,An ,  denoting the elements of the sequence.

  
1≤T≤10, 3≤n≤100000, 1≤Ai≤109

  


Output 

For each test case, print a line with one integer, denoting the answer.   
  
In order to prevent using float number, you should print the answer multiplied by  n .

  


Sample Input 
    
    
      
    
    
       1
    4
    1 2 3 4
      

  


Sample Output 
    
    
      
    
    
       6
      

  


Source 

[BestCoder Round #86](http://acm.split.hdu.edu.cn/search.php?field=problem&key=BestCoder+Round+%2386&source=1&searchmode=source)

此题为思维题，读懂题意即可：输入一个数组，随机从中删掉一个数后，将余下的新数组中相邻两数的绝对值的最大值记为F。现以相同的概率删掉其中一个数，求F的期望值。

> 当概率相等时，期望=概率（1/n）*总和，但注意最后一句话，输出期望值答案乘n,意思就是求总和就行了。

Code
    
    
    /**
    * @Date:   2016-07-21 10-41-21
    * @Project: ACM
    * @Last modified time: 2016-08-08 01-53-22
    */
    
    
    
    #include <cstring>
    #include <cstdio>
    #include <cmath>
    #include <algorithm>
    using namespace std;
    #define maxn 100005
    
    
    int n, m;
    long long sum;
    long long L[maxn], R[maxn];
    long long a[100004];
    
    
    int main () {
        int t;
        scanf ("%d", &t);
        while (t--) {
            scanf ("%d", &n);
            for (int i = 1; i <= n; i++) scanf ("%lld", &a[i]);
            sum = 0;
    
    
            //printf("==%d==%d\n",L[1],R[n]);
            L[1] = -1, R[n] = -1;//左右两端赋足够小的初值
            /**
             * 预处理，以将要被删的数为基准，往两边作预处理
             */
            for (int i = 2; i <= n; i++) { //往左预处理，使左侧最大差的绝对值为L[i]
                L[i] = max (L[i-1], abs (a[i]-a[i-1])); 
            } 
            for (int i = n-1; i >= 1; i--) { //往右预处理，使右侧最大差的绝对值为R[i]
                R[i] = max (R[i+1], abs (a[i]-a[i+1]));
            }
            /**
             * 当删去两端的数时需特殊处理，取得最大值
             * 当删去中间的数时，需考虑删去前该数与左右相邻数的差的绝对值，且产生了一个新的差值。需讨论处理
             */
            for (int i = 1; i <= n; i++) {
                if (i == 1) sum += R[2]; //当删去第一个数时，需往右考虑，此时R[2]为最大差值的绝对值
                else if (i == n) sum += L[n-1];//当删去最后一个数时，需往左考虑，此时L[n-1]是最大差值的绝对值
                //删去中间的数时，先比较删去前该数与左右两侧数的差绝对值，取较大值，再与产生的新的差绝对值比较，取最大值
                else sum += max (max (L[i-1], R[i+1]), abs (a[i+1]-a[i-1]));
            }
            printf ("%lld\n", sum);//求和，即期望*n的结果
        }
        return 0;
    }
